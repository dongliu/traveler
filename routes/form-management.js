const auth = require('../lib/auth');
const mongoose = require('mongoose');
const routesUtilities = require('../utilities/routes.js');
const Form = mongoose.model('Form');
const ReleasedForm = mongoose.model('ReleasedForm');
const reqUtils = require('../lib/req-utils');
const logger = require('../lib/loggers').getLogger();
const config = require('../config/config.js');
const authConfig = config.auth;

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
      'title formType status tags ver releasedOn releasedBy'
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
          ver: releasedForm.ver,
          base: releasedForm.base,
          discrepancy: releasedForm.discrepancy,
        })
      );
    }
  );

  app.post(
    '/released-forms/:id/clone',
    auth.ensureAuthenticated,
    reqUtils.exist('id', ReleasedForm),
    function(req, res) {
      const releasedForm = req[req.params.id];
      const base = releasedForm.base;
      const clonedForm = {};
      clonedForm.html = reqUtils.sanitizeText(base.html);
      clonedForm.title = reqUtils.sanitizeText(req.body.title);
      clonedForm.createdBy = req.session.userid;
      clonedForm.createdOn = Date.now();
      clonedForm.updatedBy = req.session.userid;
      clonedForm.updatedOn = Date.now();
      clonedForm.clonedFrom = base.reference;
      clonedForm.formType = base.formType;
      clonedForm.sharedWith = [];
      clonedForm.tags = releasedForm.tags;
      new Form(clonedForm).save(function(saveErr, newform) {
        if (saveErr) {
          logger.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        var url =
          (req.proxied ? authConfig.proxied_service : authConfig.service) +
          '/forms/' +
          newform.id +
          '/';
        res.set('Location', url);
        return res
          .status(201)
          .send(
            'You can see the new form at <a href="' + url + '">' + url + '</a>'
          );
      });
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
