var auth = require('../lib/auth');

var request = require('request');

module.exports = function (app) {
  app.get('/devices/', function (req, res) {
    res.render('devices');
  });

  app.get('/devices/json', function (req, res) {
    request({
      url: 'http://ctlapp-wheezy-temp:8080/conf/rs/v0/component/physical',
      timeout: 30 * 1000,
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
      return res.json(response.statusCode, resBody);
    });
  });
};
