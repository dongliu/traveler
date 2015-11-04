var configPath = require('../config/config.js').configPath;
var auth = require('../lib/auth');
var service = require('../' + configPath + '/service.json');
var request = require('request');

module.exports = function (app) {
  app.get('/devices/', function (req, res) {
    res.render('devices', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/devices/json', function (req, res) {
    request({
      url: service.device.url,
      timeout: 30 * 1000,
      strictSSL: false,
      headers: {
        Accept: 'application/json'
      }
    }, function (err, response, resBody) {
      if (err) {
        console.log(err);
        return res.json(503, {
          error: 'cannot retrieve device list from ctlapp-wheezy-temp'
        });
      }
      res.status(response.statusCode).type('application/json');
      return res.send(resBody);
    });
  });
};
