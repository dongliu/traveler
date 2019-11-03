const auth = require('../lib/auth');
const mongoose = require('mongoose');
const routesUtilities = require('../utilities/routes.js');
const Form = mongoose.model('Form');
const ReleasedForm = mongoose.model('ReleasedForm');
const reqUtils = require('../lib/req-utils');

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
    auth.verifyRole('admin', 'manager'),
    function(req, res) {
      Form.find(
        {
          status: 0.5,
        },
        'title formType status tags mapping _v updatedOn updatedBy'
      ).exec(function(err, forms) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        res.status(200).json(forms);
      });
    }
  );

  app.get('/released-forms/json', auth.ensureAuthenticated, function(req, res) {
    ReleasedForm.find(
      {
        status: 1,
      },
      'title formType status tags releasedOn releasedBy'
    ).exec(function(err, forms) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get(
    '/released-forms/:id/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', ReleasedForm),
    function(req, res) {
      const releasedForm = req[req.params.id];
      return res.render(
        'released-form',
        routesUtilities.getRenderObject(req, {
          id: req.params.id,
          title: releasedForm.title,
          formType: releasedForm.formType,
          base: releasedForm.base,
          discrepancy: releasedForm.discrepancy,
        })
      );
    }
  );

  app.get('/released-forms/normal/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    ReleasedForm.find(
      {
        status: 1,
        formType: 'normal',
      },
      'title formType status tags _v releasedOn releasedBy'
    ).exec(function(err, forms) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get(
    '/released-forms/discrepancy/json',
    auth.ensureAuthenticated,
    function(req, res) {
      ReleasedForm.find(
        {
          status: 1,
          formType: 'discrepancy',
        },
        'title formType status tags _v releasedOn releasedBy'
      ).exec(function(err, forms) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        res.status(200).json(forms);
      });
    }
  );
};
