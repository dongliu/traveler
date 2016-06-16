var auth = require('../lib/auth');
var config = require('../config/config.js');
var service = config.service;
var request = require('request');

module.exports = function (app) {
  app.get('/devices/', auth.ensureAuthenticated, function (req, res) {
    res.render('devices', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/devices/json', auth.ensureAuthenticated, function (req, res) {
    if (!(service && service.device && service.device.url)) {
      return res.send(500, 'do not know device service url');
    }
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
        return res.send(503, 'cannot retrieve device list from' + service.device.url);
      }
      res.status(response.statusCode);
      if (response.statusCode === 200) {
        res.type('application/json');
      }
      return res.send(resBody);
    });
  });
};
