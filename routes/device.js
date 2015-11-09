var config = require('../config/config.js');
var auth = require('../lib/auth');
var service = config.service;
var request = require('request');
var routesUtilities = require('../utilities/routes.js');

module.exports = function (app) {
  app.get('/devices/', function (req, res) {
    res.render('devices', routesUtilities.getRenderObject(req));
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
