const mongoose = require('mongoose');
const debug = require('debug')('traveler:released-form');
const _ = require('lodash');
const auth = require('../lib/auth');
const routesUtilities = require('../utilities/routes');

const Form = mongoose.model('Form');
const ReleasedForm = mongoose.model('ReleasedForm');
const { statusMap } = require('../model/released-form');
const reqUtils = require('../lib/req-utils');
const logger = require('../lib/loggers').getLogger();
const config = require('../config/config');
const { stateTransition } = require('../model/released-form');

const authConfig = config.auth;

module.exports = function(app) {
  app.get(
    '/form-management/',
    auth.ensureAuthenticated,
    auth.verifyRole('admin'),
    function(req, res) {
      res.render('form-management', routesUtilities.getRenderObject(req));
    }
  );

  app.get(
    '/submitted-forms/json',
    auth.ensureAuthenticated,
    auth.verifyRole('admin'),
    function(req, res) {
      Form.find(
        {
          status: 0.5,
        },
        'title formType status tags mapping _v __review'
      ).exec(function(err, forms) {
        if (err) {
          logger.error(err);
          return res.status(500).send(err.message);
        }
        return res.status(200).json(forms);
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
        logger.error(err);
        return res.status(500).send(err.message);
      }
      return res.status(200).json(forms);
    });
  });

  app.get('/archived-released-forms/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    ReleasedForm.find(
      {
        status: 2,
      },
      'title formType status tags ver archivedOn archivedBy'
    ).exec(function(err, forms) {
      if (err) {
        logger.error(err);
        return res.status(500).send(err.message);
      }
      return res.status(200).json(forms);
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
          status: releasedForm.status,
          statusText: statusMap[`${releasedForm.status}`],
          ver: releasedForm.ver,
          base: releasedForm.base,
          discrepancy: releasedForm.discrepancy,
        })
      );
    }
  );

  app.put(
    '/released-forms/:id/status',
    auth.ensureAuthenticated,
    reqUtils.exist('id', ReleasedForm),
    reqUtils.isOwnerOrAdminMw('id'),
    reqUtils.filter('body', ['status', 'version']),
    reqUtils.hasAll('body', ['status', 'version']),
    async function updateStatus(req, res) {
      const f = req[req.params.id];
      const s = req.body.status;
      const v = req.body.version;

      if ([2].indexOf(s) === -1) {
        return res.status(400).send('invalid status');
      }

      if (v !== f.ver) {
        return res.status(400).send(`the current version is ${f.ver}`);
      }

      // no change
      if (f.status === s) {
        return res.status(204).send();
      }

      const target = _.find(stateTransition, function(t) {
        return t.from === f.status;
      });

      debug(target);
      if (target.to.indexOf(s) === -1) {
        return res.status(400).send('invalid status change');
      }

      f.status = s;
      if (s === 2) {
        f.archivedBy = req.session.userid;
        f.archivedOn = Date.now();
      }
      // check if we need to increment the version
      // in this case, no
      f.incrementVersion();
      try {
        await f.saveWithHistory(req.session.userid);
        return res
          .status(200)
          .send(`released form ${req.params.id} status updated to ${s}`);
      } catch (error) {
        return res.status(500).send(error.message);
      }
    }
  );

  app.post(
    '/released-forms/:id/clone',
    auth.ensureAuthenticated,
    reqUtils.exist('id', ReleasedForm),
    function(req, res) {
      const releasedForm = req[req.params.id];
      const { base } = releasedForm;
      const clonedForm = {};
      clonedForm.html = reqUtils.sanitizeText(base.html);
      clonedForm.title = reqUtils.sanitizeText(req.body.title);
      clonedForm.createdBy = req.session.userid;
      clonedForm.createdOn = Date.now();
      clonedForm.updatedBy = req.session.userid;
      clonedForm.updatedOn = Date.now();
      clonedForm.clonedFrom = base._id;
      clonedForm.formType = base.formType;
      clonedForm.sharedWith = [];
      clonedForm.tags = releasedForm.tags;
      new Form(clonedForm).save(function(saveErr, newform) {
        if (saveErr) {
          logger.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        const url = `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/forms/${newform.id}/`;
        res.set('Location', url);
        return res
          .status(201)
          .send(`You can see the new form at <a href="${url}">${url}</a>`);
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
      return res.status(200).json(forms);
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
        return res.status(200).json(forms);
      });
    }
  );

  app.get(
    '/released-forms/:id/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', ReleasedForm),
    function(req, res) {
      return res.status(200).json(req[req.params.id]);
    }
  );
};
