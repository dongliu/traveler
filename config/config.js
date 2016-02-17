/**
 * @fileOverview load the config json files, and further load the resources
 */

var fs = require('fs');
var path = require('path');

var ad = require('./ad.json');
var api = require('./api.json');
var app = require('./app.json');
var auth = require('./auth.json');
var mongo = require('./mongo.json');
var service = require('./service.json');
var alias = require('./alias.json');

// load api keys
var key;
var cert;

if (api.ssl_key && api.ssl_cert) {
  key = fs.readFileSync(path.resolve(__dirname, api.ssl_key));
  cert = fs.readFileSync(path.resolve(__dirname, api.ssl_cert));
  api.credentials = {
    key: key,
    cert: cert
  };
}

//load app keys
if (app.ssl_key && app.ssl_cert) {
  key = fs.readFileSync(__dirname, app.ssl_key);
  cert = fs.readFileSync(__dirname, app.ssl_cert);
  app.credentials = {
    key: key,
    cert: cert
  };
}

app.upload_dir = path.resolve(__dirname, app.upload_dir || '../uploads/');
app.log_dir = path.resolve(__dirname, app.log_dir || '../logs/');


module.exports = {
  ad: ad,
  api: api,
  app: app,
  auth: auth,
  mongo: mongo,
  service: service,
  alias: alias
};
