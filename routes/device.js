var config = require('../config/config.js');
var auth = require('../lib/auth');
var service = config.service;
var request = require('request');
var routesUtilities = require('../utilities/routes.js');

module.exports = function (app) {
  app.get('/devices/', function (req, res) {
    switch (service.device_application){
      case 'devices':
        return res.render('devices', routesUtilities.getRenderObject(req));
        break;
      case 'cdb':
        return res.redirect(service.cdb.web_portal_url);
        break;
      default:
        return res.send(404, "No valid devices setting has been found");
    }
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
