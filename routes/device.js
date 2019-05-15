var config = require('../config/config.js');
var auth = require('../lib/auth');
var service = config.service;
var request = require('request');
var routesUtilities = require('../utilities/routes.js');

module.exports = function(app) {
  app.get('/devices/', function(req, res) {
    switch (service.device_application) {
      case 'devices':
        return res.render('devices', routesUtilities.getRenderObject(req));
      case 'cdb':
        return res.redirect(service.cdb.web_portal_url);
      default:
        return res.status(404).send('No valid devices setting has been found');
    }
  });

  app.get('/devices/json', auth.ensureAuthenticated, function(req, res) {
    if (!(service && service.device && service.device.url)) {
      return res.status(500).send('do not know device service url');
    }
    request(
      {
        url: service.device.url,
        timeout: 30 * 1000,
        strictSSL: false,
        headers: {
          Accept: 'application/json',
        },
      },
      function(err, response, resBody) {
        if (err) {
          console.log(err);
          return res
            .status(503)
            .send('cannot retrieve device list from' + service.device.url);
        }
        res.status(response.statusCode);
        if (response.statusCode === 200) {
          res.type('application/json');
        }
        return res.status(200).send(resBody);
      }
    );
  });
};
