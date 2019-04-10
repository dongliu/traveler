// let config = require('../config/config.js');
let auth = require('../lib/auth');
// let authConfig = config.auth;

let mongoose = require('mongoose');
// let path = require('path');
// let sanitize = require('google-caja-sanitizer').sanitize;
// let _ = require('lodash');
let routesUtilities = require('../utilities/routes.js');
// let reqUtils = require('../lib/req-utils');
// let shareLib = require('../lib/share');
// let tag = require('../lib/tag');
// let FormError = require('../lib/error').FormError;
// let formModel = require('../model/form');

let Form = mongoose.model('Form');

module.exports = function(app) {
  app.get('/form-management/', auth.verifyRole('manager', 'admin'), function(
    req,
    res
  ) {
    res.render('form-management', routesUtilities.getRenderObject(req));
  });

  app.get(
    '/submitted-forms/json',
    auth.ensureAuthenticated,
    auth.verifyRole(true, 'admin', 'manager'),
    function(req, res) {
      Form.find(
        {
          status: 0.5,
        },
        'title formType tags mapping _v updatedOn updatedBy'
      ).exec(function(err, forms) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        res.json(200, forms);
      });
    }
  );

  app.get('/released-forms/json', auth.ensureAuthenticated, function(req, res) {
    Form.find(
      {
        status: 1,
      },
      'title formType tags mapping _v updatedOn updatedBy'
    ).exec(function(err, forms) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.json(200, forms);
    });
  });

  app.get(
    '/released-forms/discrepency/json',
    auth.ensureAuthenticated,
    function(req, res) {
      Form.find(
        {
          status: 1,
          formType: 'discrepency',
        },
        'title formType tags mapping _v updatedOn updatedBy'
      ).exec(function(err, forms) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        res.json(200, forms);
      });
    }
  );
};
