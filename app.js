
/**
 * Module dependencies.
 */

var express = require('express'),
  routes = require('./routes'),
  about = require('./routes/about'),
  http = require('http'),
  fs = require('fs'),
  slash = require('express-slash'),
  path = require('path');


var mongoose = require('mongoose');
mongoose.connection.close();

var User = require('./model/user.js').User;
var Form = require('./model/form.js').Form;

mongoose.connect('mongodb://localhost/traveler');

mongoose.connection.on('connected', function () {
  console.log('Mongoose default connection opened.');
});

mongoose.connection.on('error',function (err) {
  console.log('Mongoose default connection error: ' + err);
});

mongoose.connection.on('disconnected', function () {
  console.log('Mongoose default connection disconnected');
});


var auth = require('./lib/auth');

var app = express();

app.enable('strict routing');

var access_logfile = fs.createWriteStream('./logs/access.log', {flags: 'a'});

app.configure(function(){
  app.set('port', process.env.PORT || 3001);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon(__dirname + '/public/favicon.ico'));
  // app.use(express.logger({stream: access_logfile}));
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({secret: 'traveler_secret',cookie: { maxAge: 28800000 }}));
  app.use(express.session());
  app.use(app.router);
  app.use(slash());
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

require('./routes/form')(app);

require('./routes/user')(app);

require('./routes/profile')(app);

require('./routes/device')(app);

app.get('/about', about.index);
app.get('/', auth.ensureAuthenticated, routes.main);
app.get('/logout', routes.logout);

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

function cleanup () {
  server._connections = 0;
  server.close( function () {
    console.log( "Closed out remaining connections.");
    // Close db connections, other chores, etc.
    mongoose.connection.close();
    process.exit();
  });

  setTimeout( function () {
   console.error("Could not close connections in time, forcing shut down");
   process.exit(1);
  }, 30*1000);

}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
