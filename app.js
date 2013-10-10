
/**
 * Module dependencies.
 */

var express = require('express'),
  routes = require('./routes'),
  about = require('./routes/about'),
  builder = require('./routes/builder'),
  test = require('./routes/test'),
  http = require('http'),
  // Client = require('cas.js'),
  fs = require('fs'),
  path = require('path');


var mongoose = require('mongoose');
var User = require('./model/user.js').User;
mongoose.connect('mongodb://localhost/traveler');

var auth = require('./lib/auth');

var app = express();

var access_logfile = fs.createWriteStream('./logs/access.log', {flags: 'a'});

// var cas = new Client({
//   base_url: 'https://liud-dev.nscl.msu.edu/cas',
//   service: 'http://localhost:3001',
//   version: 1.0
// });

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
  app.use(express.session({secret: 'traveler_secret',cookie: { maxAge: 14400000 }}));
  app.use(express.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});


require('./routes/user')(app);

require('./routes/profile')(app);

app.get('/about', about.index);
app.get('/', auth.ensureAuthenticated, routes.main);
app.get('/logout', routes.logout);
app.get('/builder', builder.index);
app.get('/test', test.index);

http.createServer(app).listen(app.get('port'), function(){
  // logger.info("Express server listening on port " + app.get('port'));
  console.log("Express server listening on port " + app.get('port'));
});


// function ensureAuthenticated(req, res, next) {
//   if (req.session.username) {
//     console.log(req.session);
//     next();
//   } else if (req.param('ticket')) {
//     cas.validate(req.param('ticket'), function(err, status, username) {
//       if (err) {
//         res.send(401, err.message);
//       } else {
//         req.session.username = username;
//         next();
//       }
//     });
//   } else {
//     res.redirect('https://' + cas.hostname + cas.base_path + '/login?service=' + encodeURIComponent(cas.service));
//   }
// }