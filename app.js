/* jslint es5: true */

var config = require('./config/config.js');
config.load();

var express = require('express');
var compression = require('compression');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var methodOverride = require('method-override');
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');

var http = require('http');
var https = require('https');
var fs = require('fs');
var multer = require('multer');
var path = require('path');

const logger = require('./lib/loggers').getLogger();

var rotator = require('file-stream-rotator');

var mongoose = require('mongoose');

var configPath = config.configPath;
var apiSettings = config.api;
var mongoConfig = config.mongo;
var appSettings = config.app;

// Load MongoDB object modeling tool
mongoose.connection.close();
// Load MongoDB models
require('./model/user.js');
require('./model/form.js');
require('./model/released-form.js');
require('./model/traveler.js');
require('./model/binder.js');
require('./model/history.js');

//Connect to mongo database
var mongoAddress = 'mongodb://';
mongoAddress += mongoConfig.server_address || 'localhost';
mongoAddress += ':' + (mongoConfig.server_port || '27017');
mongoAddress += '/' + (mongoConfig.traveler_db || 'traveler');

var mongoOptions = {
  native_parser: true,
  poolSize: 5,
  connectTimeoutMS: 30000,
  keepAlive: 1,
};

// Set authentication options if specified
if (mongoConfig.username !== undefined) {
  mongoOptions.user = mongoConfig.username;
  mongoOptions.pass = mongoConfig.password;
}
if (mongoConfig.auth) {
  mongoOptions.auth = config.mongo.auth;
}

mongoose.connect(mongoAddress, mongoOptions);
mongoose.connection.on('connected', function() {
  logger.info('Mongoose default connection opened.');
});

mongoose.connection.on('error', function(err) {
  logger.info('Mongoose default connection error: ' + err);
});

mongoose.connection.on('disconnected', function() {
  logger.info('Mongoose default connection disconnected');
});

// LDAP client
var adClient = require('./lib/ldap-client');
adClient.getDefaultClient(function(client, ldapClientCleanup) {
  logger.info('ldap connection successfully tested');
  ldapClientCleanup();
});

// CAS client
var auth = require('./lib/auth');

// api and web app
var api = express();
var app = express();

/* Configure Web Application */
app.locals.orgName = appSettings.org_name;

app.enable('strict routing');
if (app.get('env') === 'production') {
  var access_logfile = rotator.getStream({
    filename: path.resolve(appSettings.log_dir, 'access.log'),
    frequency: 'daily',
  });
}

app.set('port', process.env.PORT || appSettings.app_port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
if (app.get('env') === 'production') {
  app.use(
    morgan('common', {
      stream: access_logfile,
    })
  );
}

//TODO test
//app.set('logger', logger);

app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(favicon(__dirname + '/public/favicon.ico'));
if (app.get('env') === 'development') {
  app.use(morgan('common'));
}

app.use(methodOverride());
app.use(cookieParser());
app.use(
  expressSession({
    secret: appSettings.cookie_sec || 'traveler_secret',
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: appSettings.cookie_life || 28800000,
    },
  })
);
app.use(
  multer({
    dest: config.uploadPath,
    limits: {
      files: 1,
      fileSize: (config.app.upload_size || 10) * 1024 * 1024,
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auth.proxied);
app.use(auth.sessionLocals);

if (app.get('env') === 'development') {
  app.use(errorHandler());
}

var routes = require('./routes');

require('./routes/main')(app);
require('./routes/form')(app);
require('./routes/form-management')(app);
require('./routes/traveler')(app);
require('./routes/binder')(app);
require('./routes/report')(app);
require('./routes/admin')(app);
require('./routes/user')(app);
require('./routes/group')(app);
require('./routes/profile')(app);
require('./routes/device')(app);
require('./routes/ldaplogin')(app);
require('./routes/doc')(app);

app.get('/api', function(req, res) {
  res.render('api', {
    prefix: req.proxied ? req.proxied_prefix : '',
  });
});

// app.get('/', auth.ensureAuthenticated, routes.main);
app.get('/login', auth.ensureAuthenticated, function(req, res) {
  if (req.session.userid) {
    return res.redirect(req.proxied ? auth.proxied_service : '/');
  }

  // something wrong
  res.send(400, 'please enable cookie in your browser');
});

app.get('/logout', routes.logout);
app.get('/apis', function(req, res) {
  res.redirect('https://' + req.host + ':' + api.get('port') + req.originalUrl);
});

// Start application using settings
var appPort = appSettings.app_port;
var server;
if (appSettings.ssl_key !== undefined) {
  var appCredentials = {
    key: fs.readFileSync('./' + configPath + '/' + appSettings.ssl_key),
    cert: fs.readFileSync('./' + configPath + '/' + appSettings.ssl_cert),
  };
  server = https.createServer(appCredentials, app).listen(appPort, function() {
    logger.info('Express server listening on ssl port ' + appPort);
  });
} else {
  server = http.createServer(app).listen(app.get('port'), function() {
    logger.info('Express server listening on port ' + app.get('port'));
  });
}

/* Configure REST API */
var apiPort = apiSettings.app_port;
api.enable('strict routing');

api.set('port', process.env.APIPORT || apiPort);
api.use(morgan('common'));

// api.use(express.logger({stream: access_logfile}));
api.use(express.json());
api.use(express.urlencoded({ extended: true }));
api.use(auth.basicAuth);
api.use(compression());

require('./routes/api')(api);

//Start Api using settings
var apiserver;
if (apiSettings.ssl_key !== undefined) {
  var apiCredentials = {
    key: fs.readFileSync('./' + configPath + '/' + apiSettings.ssl_key),
    cert: fs.readFileSync('./' + configPath + '/' + apiSettings.ssl_cert),
  };

  apiserver = https
    .createServer(apiCredentials, api)
    .listen(api.get('port'), function() {
      logger.info('API server listening on ssl port ' + api.get('port'));
    });
} else {
  apiserver = http.createServer(api).listen(api.get('port'), function() {
    logger.info('API server listening on port ' + api.get('port'));
  });
}

// When the node.js application is closed.
function cleanup() {
  server._connections = 0;
  apiserver._connections = 0;
  mongoose.connection.close();

  server.close(function() {
    apiserver.close(function() {
      logger.info('web and api servers close.');

      // Close db connections, other chores, etc.
      process.exit();
    });
  });

  setTimeout(function() {
    logger.error('Could not close connections in time, forcing shut down');
    process.exit(1);
  }, 30 * 1000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
