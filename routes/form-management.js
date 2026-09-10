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
const { Manager, Admin } = require('../lib/role');
const {
  computeVer,
  computeCompositionKey,
  findInputNameCollisions,
} = require('../lib/composed-released-form');

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
          aclForms: releasedForm.aclForms,
        })
      );
    }
  );

  app.get(
    '/released-forms/:id/compose',
    auth.ensureAuthenticated,
    auth.verifyRole(Manager, Admin),
    reqUtils.exist('id', ReleasedForm),
    function(req, res) {
      const base = req[req.params.id];
      if (base.formType !== 'normal' || base.status !== 1) {
        return res
          .status(400)
          .send(
            `${base.id} is not a released normal form and cannot be composed`
          );
      }
      return res.render(
        'released-form-compose',
        routesUtilities.getRenderObject(req, {
          id: req.params.id,
          title: base.title,
          baseHtml: base.base.html,
          baseVer: base.ver,
        })
      );
    }
  );

  app.get(
    '/released-forms/:id/compositions/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', ReleasedForm),
    async function(req, res) {
      const base = req[req.params.id];
      try {
        const compositions = await ReleasedForm.find({
          formType: 'normal_acl',
          status: 1,
          'base._id': base.base._id,
        }).exec();
        return res.status(200).json(compositions);
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }
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

  app.post(
    '/released-forms/:id/compose',
    auth.ensureAuthenticated,
    auth.verifyRole(Manager, Admin),
    reqUtils.exist('id', ReleasedForm),
    function(req, res, next) {
      const base = req[req.params.id];
      if (base.formType !== 'normal') {
        return res.status(400).send(`${base.id} is not a normal form`);
      }
      if (base.status !== 1) {
        return res.status(400).send(`${base.id} is not released`);
      }
      return next();
    },
    async function compose(req, res) {
      const base = req[req.params.id];
      const aclFormIds = _.uniq(req.body.aclFormIds || []);

      if (aclFormIds.indexOf(req.params.id) !== -1) {
        return res
          .status(400)
          .send('cannot attach a form to itself as an ACL form');
      }

      let aclForms = [];
      try {
        if (aclFormIds.length > 0) {
          aclForms = await ReleasedForm.find({ _id: { $in: aclFormIds } });
        }
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }

      const foundIds = aclForms.map(f => `${f._id}`);
      const missing = aclFormIds.filter(id => foundIds.indexOf(id) === -1);
      if (missing.length > 0) {
        return res
          .status(400)
          .send(`cannot find released ACL form(s): ${missing.join(', ')}`);
      }

      const invalid = aclForms.find(
        f => f.formType !== 'ACL' || f.status !== 1
      );
      if (invalid) {
        return res.status(400).send(`${invalid.id} is not a released ACL form`);
      }

      // ReleasedForm.find({ _id: { $in: aclFormIds } }) does not preserve
      // aclFormIds' order, so re-order the results to match the placement
      // the user chose before it is persisted (and later rendered) in order
      const aclFormsById = {};
      aclForms.forEach(f => {
        aclFormsById[`${f._id}`] = f;
      });
      const orderedAclForms = aclFormIds.map(id => aclFormsById[id]);

      const entries = [{ label: base.title, html: base.base.html }].concat(
        orderedAclForms.map(f => ({ label: f.title, html: f.base.html }))
      );
      const collisions = findInputNameCollisions(entries);
      if (collisions.length > 0) {
        const names = collisions.map(c => c.name).join(', ');
        return res
          .status(400)
          .send(`duplicated input name(s) across the composed forms: ${names}`);
      }

      // compositionKey is based on the underlying form ids (base.base._id /
      // f.base._id), not the released-form ids, so composing the same base
      // and ACL forms again after any of them gets a new release is still
      // treated as a duplicate of the existing active composition, unless
      // that one is archived first (see the "prior compositions" step)
      const sortedAclFormIds = orderedAclForms.map(f => `${f.base._id}`).sort();
      const composed = {};
      composed.title = req.body.title || base.title;
      composed.description = base.description;
      composed.tags = base.tags;
      composed.formType = 'normal_acl';
      composed.base = base.base;
      composed.aclForms = orderedAclForms.map(f => f.base);
      composed.ver = computeVer(
        base.ver,
        orderedAclForms.map(f => f.ver)
      );
      composed.compositionKey = computeCompositionKey(
        `${base.base._id}`,
        sortedAclFormIds
      );
      composed.releasedBy = req.session.userid;
      composed.releasedOn = Date.now();

      try {
        const existingForm = await ReleasedForm.findOne({
          title: composed.title,
          formType: composed.formType,
          compositionKey: composed.compositionKey,
          // only search the active released form, not archived
          status: 1,
        });
        if (existingForm) {
          return res
            .status(400)
            .send(
              `A form with the same title and composition was already released in ${existingForm._id}.`
            );
        }
        const saveForm = await new ReleasedForm(composed).saveWithHistory(
          req.session.userid
        );
        const url = `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/released-forms/${saveForm._id}/`;
        return res.status(201).json({
          location: url,
        });
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }
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

  app.get('/released-forms/acl/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    ReleasedForm.find(
      {
        status: 1,
        formType: 'ACL',
      },
      'title formType status tags _v releasedOn releasedBy base'
    ).exec(function(err, forms) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      return res.status(200).json(forms);
    });
  });

  app.get(
    '/released-forms/:id/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', ReleasedForm),
    function(req, res) {
      return res.status(200).json(req[req.params.id]);
    }
  );
};
