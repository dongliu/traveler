/*jslint es5: true*/

var express = require('express');
var routes = require('./routes');
var http = require('http');
var https = require('https');
var multer = require('multer');
var path = require('path');

var rotator = require('file-stream-rotator');

var config = require('./config/config.js');

var mongoose = require('mongoose');

var favicon = require('serve-favicon');
var logger = require('morgan');
var methodOverride = require('method-override');
var session = require('express-session');
var bodyParser = require('body-parser');
var errorHandler = require('errorhandler');
var compression = require('compression');
var cookieParser = require('cookie-parser');

mongoose.connection.close();

require('./model/user.js');
require('./model/form.js');
require('./model/traveler.js');
require('./model/binder.js');

var mongoOptions = {
  db: {
    native_parser: true
  },
  server: {
    poolSize: 5,
    socketOptions: {
      connectTimeoutMS: 30000,
      keepAlive: 1
    }
  }
};

var mongoURL = 'mongodb://' + (config.mongo.address || 'localhost') + ':' + (config.mongo.port || '27017') + '/' + (config.mongo.db || 'traveler');

if (config.mongo.user && config.mongo.pass) {
  mongoOptions.user = config.mongo.user;
  mongoOptions.pass = config.mongo.pass;
}

if (config.mongo.auth) {
  mongoOptions.auth = config.mongo.auth;
}

mongoose.connect(mongoURL, mongoOptions);

mongoose.connection.on('connected', function () {
  console.log('Mongoose default connection opened.');
});

mongoose.connection.on('error', function (err) {
  console.log('Mongoose default connection error: ' + err);
});

mongoose.connection.on('disconnected', function () {
  console.log('Mongoose default connection disconnected');
});

var adClient = require('./lib/ldap-client').client;
adClient.on('connect', function () {
  console.log('ldap client connected');
});
adClient.on('timeout', function (message) {
  console.error(message);
});
adClient.on('error', function (error) {
  console.error(error);
});

var auth = require('./lib/auth');

var app = express();

var api = express();

app.enable('strict routing');

if (app.get('env') === 'production') {
  var access_logfile = rotator.getStream({
    filename: path.resolve(config.app.log_dir, 'access.log'),
    frequency: 'daily'
  });
}


app.set('port', process.env.PORT || config.app.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
if (app.get('env') === 'production') {
  app.use(logger({
    stream: access_logfile
  }));
}
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'bower_components')));
app.use(favicon(__dirname + '/public/favicon.ico'));
if (app.get('env') === 'development') {
  app.use(logger('dev'));
}
app.use(methodOverride());
app.use(cookieParser());
app.use(session({
  secret: config.app.cookie_sec || 'traveler_secret',
  cookie: {
    maxAge: config.app.cookie_life || 28800000
  },
  resave: true,
  saveUninitialized: true
}));
app.use(multer({
  dest: config.app.upload_dir,
  limits: {
    files: 1,
    fileSize: (config.app.upload_size || 10) * 1024 * 1024
  }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(auth.proxied);
app.use(auth.sessionLocals);

if ('development' == app.get('env')) {
  app.use(errorHandler());
}

require('./routes/form')(app);

require('./routes/traveler')(app);

require('./routes/binder')(app);

require('./routes/admin')(app);

require('./routes/user')(app);

require('./routes/profile')(app);

require('./routes/device')(app);

require('./routes/doc')(app);

app.get('/api', function (req, res) {
  res.render('api', {
    prefix: req.proxied ? req.proxied_prefix : ''
  });
});
app.get('/', routes.main);
app.get('/login', auth.ensureAuthenticated, function (req, res) {
  if (req.session.userid) {
    return res.redirect(req.proxied ? auth.proxied_service : '/');
  }
  // something wrong
  res.send(400, 'please enable cookie in your browser');
});
app.get('/logout', routes.logout);
app.get('/apis', function (req, res) {
  res.redirect('https://' + req.host + ':' + api.get('port') + req.originalUrl);
});

api.enable('strict routing');

api.set('port', process.env.APIPORT || config.api.port);
api.use(logger('dev'));
api.use(auth.basicAuth);
api.use(compression());


require('./routes/api')(api);

var server = http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

var apiserver = https.createServer(config.api.credentials, api).listen(api.get('port'), function () {
  console.log('API server listening on port ' + api.get('port'));
});

function cleanup() {
  server._connections = 0;
  apiserver._connections = 0;
  mongoose.connection.close();
  adClient.unbind(function () {
    console.log('ldap client stops.');
  });
  server.close(function () {
    apiserver.close(function () {
      console.log('web and api servers close.');
      // Close db connections, other chores, etc.
      process.exit();
    });
  });

  setTimeout(function () {
    console.error('Could not close connections in time, forcing shut down');
    process.exit(1);
  }, 30 * 1000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
