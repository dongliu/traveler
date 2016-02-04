/*jslint es5: true*/

var express = require('express'),
  routes = require('./routes'),
  // about = require('./routes/about'),
  http = require('http'),
  https = require('https'),
  fs = require('fs'),
  multer = require('multer'),
  path = require('path');

var rotator = require('file-stream-rotator');

var key = fs.readFileSync('./config/node.key'),
  cert = fs.readFileSync('./config/node.pem'),
  credentials = {
    key: key,
    cert: cert
  };


var mongoose = require('mongoose');
mongoose.connection.close();

require('./model/user.js');
require('./model/form.js');
require('./model/traveler.js');
require('./model/working_package.js');

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

mongoose.connect('mongodb://localhost/traveler', mongoOptions);

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

var auth = require('./lib/auth');

var app = express();

var api = express();

var uploadDir = './uploads/';

app.enable('strict routing');

if (app.get('env') === 'production') {
  var access_logfile = rotator.getStream({
    filename: __dirname + '/logs/access.log',
    frequency: 'daily'
  });
}

app.configure(function () {
  app.set('port', process.env.PORT || 3001);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  if (app.get('env') === 'production') {
    app.use(express.logger({
      stream: access_logfile
    }));
  }
  app.use(express.compress());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.favicon(__dirname + '/public/favicon.ico'));
  if (app.get('env') === 'development') {
    app.use(express.logger('dev'));
  }
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: 'traveler_secret',
    cookie: {
      maxAge: 28800000
    }
  }));
  app.use(multer({
    dest: uploadDir,
    limits: {
      files: 1,
      fileSize: 5 * 1024 * 1024
    }
  }));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(auth.proxied);
  app.use(auth.sessionLocals);
  app.use(app.router);
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

require('./routes/form')(app);

require('./routes/traveler')(app);

require('./routes/working_package')(app);

require('./routes/user')(app);

require('./routes/profile')(app);

require('./routes/device')(app);

require('./routes/about')(app);

app.get('/api', function (req, res) {
  res.render('api', {
    prefix: req.proxied ? req.proxied_prefix : ''
  });
});
app.get('/', routes.main);
app.get('/login', auth.ensureAuthenticated, function (req, res) {
  if (!!req.session.userid) {
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
api.configure(function () {
  api.set('port', process.env.APIPORT || 3443);
  api.use(express.logger('dev'));
  // api.use(express.logger({stream: access_logfile}));
  api.use(auth.basicAuth);
  api.use(express.compress());
  api.use(api.router);
});

require('./routes/api')(api);

var server = http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

var apiserver = https.createServer(credentials, api).listen(api.get('port'), function () {
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
    console.error("Could not close connections in time, forcing shut down");
    process.exit(1);
  }, 30 * 1000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
