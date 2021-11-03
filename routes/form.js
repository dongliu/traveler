const debug = require('debug')('traveler:route:form');
const _ = require('lodash');
const mongoose = require('mongoose');
const path = require('path');
const config = require('../config/config');
const auth = require('../lib/auth');

const authConfig = config.auth;

const routesUtilities = require('../utilities/routes');
const reqUtils = require('../lib/req-utils');
const shareLib = require('../lib/share');
const tag = require('../lib/tag');
const formModel = require('../model/form');
const reviewLib = require('../lib/review');

const Form = mongoose.model('Form');
const FormFile = mongoose.model('FormFile');
const ReleasedForm = mongoose.model('ReleasedForm');
const FormContent = mongoose.model('FormContent');
const User = mongoose.model('User');
const Group = mongoose.model('Group');
const { stateTransition } = require('../model/form');

const logger = require('../lib/loggers').getLogger();

function checkReviewer(form, userid) {
  return (
    form.__review &&
    form.__review.reviewRequests &&
    form.__review.reviewRequests.id(userid)
  );
}

module.exports = function(app) {
  app.get('/forms/', auth.ensureAuthenticated, function(req, res) {
    res.render('forms', routesUtilities.getRenderObject(req));
  });

  app.get('/forms/json', auth.ensureAuthenticated, async function(req, res) {
    try {
      const forms = await Form.find(
        {
          createdBy: req.session.userid,
          archived: {
            $ne: true,
          },
          status: 0,
          owner: {
            $exists: false,
          },
        },
        'title formType status tags mapping createdBy createdOn updatedBy updatedOn publicAccess sharedWith sharedGroup _v'
      ).exec();
      return res.status(200).json(forms);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

  // forms owned by the user that are under review
  app.get('/submittedforms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    try {
      const forms = await Form.find(
        {
          createdBy: req.session.userid,
          archived: {
            $ne: true,
          },
          status: {
            $in: [0.5, 1],
          },
          owner: {
            $exists: false,
          },
        },
        'title formType status tags mapping createdBy createdOn updatedBy updatedOn publicAccess sharedWith sharedGroup _v'
      ).exec();
      return res.status(200).json(forms);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

  app.get('/transferredforms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    try {
      const forms = await Form.find(
        {
          owner: req.session.userid,
          archived: {
            $ne: true,
          },
        },
        'title formType status tags createdBy createdOn updatedBy updatedOn transferredOn publicAccess sharedWith sharedGroup'
      ).exec();
      return res.status(200).json(forms);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

  app.get('/allforms/json', auth.ensureAuthenticated, async function(req, res) {
    if (!routesUtilities.checkUserRole(req, 'read_all_forms')) {
      return res.status(401).json('You are not authorized to view all forms.');
    }
    try {
      const forms = await Form.find(
        {},
        'title formType status tags createdBy createdOn updatedBy updatedOn sharedWith sharedGroup'
      )
        .lean()
        .exec();
      return res.status(200).json(forms);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

  app.get('/sharedforms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    try {
      const me = await User.findOne(
        {
          _id: req.session.userid,
        },
        'forms'
      ).exec();
      if (!me) {
        return res.status(400).send('cannot identify the current user');
      }
      const forms = await Form.find(
        {
          _id: {
            $in: me.forms,
          },
          archived: {
            $ne: true,
          },
        },
        'title formType status tags owner updatedBy updatedOn publicAccess sharedWith sharedGroup'
      ).exec();
      return res.status(200).json(forms);
    } catch (error) {
      debug(`error: ${error}`);
      return res.status(500).send(error.message);
    }
  });

  app.get('/groupsharedforms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    try {
      const groups = await Group.find(
        {
          _id: {
            $in: req.session.memberOf,
          },
        },
        'forms'
      ).exec();
      const formids = [];
      let i;
      let j;
      // merge the forms arrays
      for (i = 0; i < groups.length; i += 1) {
        for (j = 0; j < groups[i].forms.length; j += 1) {
          if (formids.indexOf(groups[i].forms[j]) === -1) {
            formids.push(groups[i].forms[j]);
          }
        }
      }
      const forms = await Form.find(
        {
          _id: {
            $in: formids,
          },
          archived: {
            $ne: true,
          },
        },
        'title formType status tags owner updatedBy updatedOn publicAccess sharedWith sharedGroup'
      ).exec();
      return res.status(200).json(forms);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

  app.get('/archivedforms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    const search = {
      $and: [
        {
          $or: [
            {
              createdBy: req.session.userid,
              owner: {
                $exists: false,
              },
            },
            {
              owner: req.session.userid,
            },
          ],
        },
        {
          $or: [
            {
              archived: true,
            },
            {
              status: 2,
            },
          ],
        },
      ],
    };
    try {
      const forms = await Form.find(
        search,
        'title formType status tags updatedBy updatedOn _v'
      ).exec();
      return res.status(200).json(forms);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

  app.get('/publicforms/', auth.ensureAuthenticated, function(req, res) {
    res.render('public-forms', routesUtilities.getRenderObject(req));
  });

  app.get('/publicforms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    try {
      const forms = await Form.find({
        publicAccess: {
          $in: [0, 1],
        },
        archived: {
          $ne: true,
        },
      }).exec();
      return res.status(200).json(forms);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

  app.get('/forms/new', auth.ensureAuthenticated, function(req, res) {
    return res.render('form-new', routesUtilities.getRenderObject(req));
  });

  app.get(
    '/forms/:id/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    function formBuilder(req, res) {
      const form = req[req.params.id];
      const access = reqUtils.getAccess(req, form);

      if (access === -1) {
        return res
          .status(403)
          .send('you are not authorized to access this resource');
      }

      if (form.archived) {
        return res.redirect(
          `${
            req.proxied ? authConfig.proxied_service : authConfig.service
          }/forms/${req.params.id}/preview`
        );
      }

      const isReviewer = checkReviewer(form, req.session.userid);
      const allApproved = form.allApproved();

      if (access === 1 && form.isEditable()) {
        return res.render(
          'form-builder',
          routesUtilities.getRenderObject(req, {
            id: req.params.id,
            title: form.title,
            html: form.html,
            status: form.status,
            statusText: formModel.statusMap[`${form.status}`],
            _v: form._v,
            formType: form.formType,
            prefix: req.proxied ? req.proxied_prefix : '',
            isReviewer,
            allApproved,
            review: form.__review,
            released_form_version_mgmt: config.app.released_form_version_mgmt,
          })
        );
      }

      return res.redirect(
        `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/forms/${req.params.id}/preview`
      );
    }
  );

  app.get(
    '/forms/:id/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canReadMw('id'),
    function(req, res) {
      return res.status(200).json(req[req.params.id]);
    }
  );

  app.get(
    '/forms/:id/released/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canReadMw('id'),
    async function(req, res) {
      try {
        const forms = await ReleasedForm.find({
          'base._id': req.params.id,
          status: 1, // released
        }).exec();
        return res.status(200).json(forms);
      } catch (error) {
        return res.status(500).send(error.message);
      }
    }
  );

  app.post(
    '/forms/:id/uploads/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canWriteMw('id'),
    async function(req, res) {
      const doc = req[req.params.id];
      if (_.isEmpty(req.files)) {
        return res.status(400).send('Expect One uploaded file');
      }

      if (!req.body.name) {
        return res.status(400).send('Expect input name');
      }

      const file = new FormFile({
        form: doc._id,
        value: req.files[req.body.name].originalname,
        file: {
          path: req.files[req.body.name].path,
          encoding: req.files[req.body.name].encoding,
          mimetype: req.files[req.body.name].mimetype,
        },
        inputType: req.body.type,
        uploadedBy: req.session.userid,
        uploadedOn: Date.now(),
      });
      try {
        const newFile = await file.save();
        const url = `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/formfiles/${newFile.id}`;
        res.set('Location', url);
        return res
          .status(201)
          .send(
            `The uploaded file is at <a target="_blank" href="${url}">${url}</a>`
          );
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }
    }
  );

  app.get(
    '/formfiles/:id',
    auth.ensureAuthenticated,
    reqUtils.exist('id', FormFile),
    function(req, res) {
      const data = req[req.params.id];
      if (data.inputType === 'file') {
        return res.sendFile(path.resolve(data.file.path));
      }
      return res.status(500).send('it is not a file');
    }
  );

  app.get(
    '/forms/:id/preview',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canReadMw('id'),
    function(req, res) {
      const form = req[req.params.id];
      return res.render(
        'form-viewer',
        routesUtilities.getRenderObject(req, {
          id: req.params.id,
          title: form.title,
          html: form.html,
        })
      );
    }
  );

  app.get(
    '/forms/:id/config',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.archived('id', false),
    function(req, res) {
      const doc = req[req.params.id];
      return res.render(
        'form-config',
        routesUtilities.getRenderObject(req, {
          form: doc,
          isOwner: reqUtils.isOwner(req, doc),
        })
      );
    }
  );

  app.get(
    '/forms/:id/share/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const form = req[req.params.id];
      return res.render(
        'share',
        routesUtilities.getRenderObject(req, {
          type: 'form',
          id: req.params.id,
          title: form.title,
          access: String(form.publicAccess),
        })
      );
    }
  );

  app.get(
    '/forms/:id/review/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const form = req[req.params.id];
      return res.render(
        'review',
        routesUtilities.getRenderObject(req, {
          type: 'form',
          id: req.params.id,
          title: form.title,
          requestedBy: form.__review.requestedBy,
          requestedOn: form.__review.requestedOn,
        })
      );
    }
  );

  app.get(
    '/forms/:id/review/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const form = req[req.params.id];
      return res.status(200).json(form.__review || {});
    }
  );

  // add a new review request
  app.post(
    '/forms/:id/review/requests',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    async function(req, res) {
      const form = req[req.params.id];
      await reviewLib.addReviewRequest(req, res, form);
    }
  );

  // remove a review request
  app.delete(
    '/forms/:id/review/requests/:requestId',
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    auth.ensureAuthenticated,
    async function(req, res) {
      const form = req[req.params.id];
      await reviewLib.removeReviewRequest(req, res, form);
    }
  );

  // add a new review request
  app.post(
    '/forms/:id/review/results',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    function(req, res, next) {
      const isReviewer = checkReviewer(req[req.params.id], req.session.userid);
      if (!isReviewer) {
        return res.status(401).send('only reviewer can submit');
      }
      return next();
    },
    async function(req, res) {
      const form = req[req.params.id];
      await reviewLib.addReviewResult(req, res, form);
    }
  );

  app.put(
    '/forms/:id/share/public',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['access']),
    async function(req, res) {
      const form = req[req.params.id];
      let { access } = req.body;
      if (['-1', '0', '1'].indexOf(access) === -1) {
        return res.status(400).send('not valid value');
      }
      access = Number(access);
      if (form.publicAccess === access) {
        return res.status(204).send();
      }
      form.publicAccess = access;
      try {
        await form.save();
        return res
          .status(200)
          .send(`public access is set to ${req.body.access}`);
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }
    }
  );

  app.get(
    '/forms/:id/share/:list/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const form = req[req.params.id];
      if (req.params.list === 'users') {
        return res.status(200).json(form.sharedWith || []);
      }
      if (req.params.list === 'groups') {
        return res.status(200).json(form.sharedGroup || []);
      }
      return res.status(400).send('unknown share list.');
    }
  );

  app.post(
    '/forms/:id/share/:list/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const form = req[req.params.id];
      let share = -2;
      if (req.params.list === 'users') {
        if (req.body.name) {
          share = reqUtils.getSharedWith(form.sharedWith, req.body.name);
        } else {
          return res.status(400).send('user name is empty.');
        }
      }
      if (req.params.list === 'groups') {
        if (req.body.id) {
          share = reqUtils.getSharedGroup(form.sharedGroup, req.body.id);
        } else {
          return res.status(400).send('group id is empty.');
        }
      }

      if (share === -2) {
        return res.status(400).send('unknown share list.');
      }

      if (share >= 0) {
        return res
          .status(400)
          .send(
            req.body.name ||
              `${req.body.id} is already in the ${req.params.list} list.`
          );
      }

      // share === -1
      return shareLib.addShare(req, res, form);
    }
  );

  app.put(
    '/forms/:id/share/:list/:shareid',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['access']),
    async function(req, res) {
      const form = req[req.params.id];
      let share;
      if (req.params.list === 'users') {
        share = form.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = form.sharedGroup.id(req.params.shareid);
      }
      if (!share) {
        return res
          .status(400)
          .send(`cannot find ${req.params.shareid} in the list.`);
      }
      // change the access
      if (req.body.access === 'write') {
        share.access = 1;
      } else if (req.body.access === 'read') {
        share.access = 0;
      } else {
        return res
          .status(400)
          .send(`cannot take the access ${req.body.access}`);
      }
      try {
        await form.save();
        // check consistency of user's form list
        let Target;
        if (req.params.list === 'users') {
          Target = User;
        }
        if (req.params.list === 'groups') {
          Target = Group;
        }
        const newTarget = await Target.findByIdAndUpdate(req.params.shareid, {
          $addToSet: {
            forms: form._id,
          },
        });
        if (!newTarget) {
          logger.error(`The user/group ${req.params.shareid} is not in the db`);
          return res
            .status(404)
            .send(`user/group ${req.params.shareid} not found`);
        }
        return res.status(200).json(share);
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }
    }
  );

  app.delete(
    '/forms/:id/share/:list/:shareid',
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    auth.ensureAuthenticated,
    function(req, res) {
      const form = req[req.params.id];
      shareLib.removeShare(req, res, form);
    }
  );

  app.post(
    '/forms/',
    auth.ensureAuthenticated,
    reqUtils.filter('body', ['title', 'formType', 'html']),
    reqUtils.hasAll('body', ['title']),
    auth.requireRoles(req => {
      return (
        req.body.hasOwnProperty('formType') &&
        req.body.formType === 'discrepancy'
      );
    }, 'admin'),
    reqUtils.sanitize('body', ['html']),
    function(req, res) {
      const html = req.body.html || '';
      formModel.createForm(
        {
          title: req.body.title,
          formType: req.body.formType,
          createdBy: req.session.userid,
          html,
        },
        function(err, newform) {
          if (err) {
            logger.error(err);
            return res.status(500).send(err.message);
          }
          const url = `${
            req.proxied ? authConfig.proxied_service : authConfig.service
          }/forms/${newform.id}/`;

          res.set('Location', url);
          return res.status(303).json({
            location: url,
          });
        }
      );
    }
  );

  app.post(
    '/forms/:id/clone',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canReadMw('id'),
    function(req, res) {
      const doc = req[req.params.id];
      const form = {};
      form.html = reqUtils.sanitizeText(doc.html);
      form.title = reqUtils.sanitizeText(req.body.title);
      form.createdBy = req.session.userid;
      form.createdOn = Date.now();
      form.updatedBy = req.session.userid;
      form.updatedOn = Date.now();
      form.clonedFrom = doc._id;
      form.formType = doc.formType;
      form.sharedWith = [];
      form.tags = doc.tags;

      new Form(form).save(function(saveErr, newform) {
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

  app.put(
    '/forms/:id/archived',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['archived']),
    async function(req, res) {
      const doc = req[req.params.id];
      if (doc.archived === req.body.archived) {
        return res.status(204).send();
      }

      doc.archived = req.body.archived;
      if (doc.archived) {
        doc.archivedOn = Date.now();
      }
      try {
        const newDoc = await doc.save();
        return res
          .status(200)
          .send(
            `Form ${req.params.id} archived state set to ${newDoc.archived}`
          );
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }
    }
  );

  app.put(
    '/forms/:id/owner',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['name']),
    function(req, res) {
      const doc = req[req.params.id];
      shareLib.changeOwner(req, res, doc);
    }
  );

  app.put(
    '/forms/:id/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canWriteMw('id'),
    reqUtils.status('id', [0, 0.5]),
    reqUtils.filter('body', ['html', 'title', 'description']),
    reqUtils.sanitize('body', ['html', 'title', 'description']),
    async function(req, res) {
      if (!req.is('json')) {
        return res.status(415).send('json request expected');
      }
      const doc = req[req.params.id];
      if (req.body.hasOwnProperty('html')) {
        doc.html = req.body.html;
      }
      if (req.body.hasOwnProperty('title')) {
        if (reqUtils.isOwner(req, doc)) {
          doc.title = req.body.title;
        } else {
          req.send(403, 'not authorized to access this resource');
        }
      }

      if (req.body.hasOwnProperty('description')) {
        if (reqUtils.isOwner(req, doc)) {
          doc.description = req.body.description;
        } else {
          req.send(403, 'not authorized to access this resource');
        }
      }

      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.incrementVersion();
      try {
        const newDoc = await doc.saveWithHistory(req.session.userid);
        return res.json(newDoc);
      } catch (error) {
        return res.status(500).send(error.message);
      }
    }
  );

  // add tag routines
  tag.addTag(app, '/forms/:id/tags/', Form);
  tag.removeTag(app, '/forms/:id/tags/:tag', Form);

  app.put(
    '/forms/:id/released',
    auth.ensureAuthenticated,
    // find the unreleased form
    reqUtils.exist('id', Form),
    // owner decide if release
    reqUtils.isOwnerMw('id'),
    function(req, res, next) {
      if (req[req.params.id].status !== 0.5) {
        return res
          .status(400)
          .send(`${req[req.params.id].id} has not been submitted for review`);
      }
      return next();
    },
    function(req, res, next) {
      if (!req[req.params.id].allApproved) {
        return res
          .status(400)
          .send(`${req[req.params.id].id} was not approved by all reviewers`);
      }
      return next();
    },
    // if the base form is normal then load the released discrepancy form
    function(req, res, next) {
      debug(req.body.discrepancyFormId);
      debug(req[req.params.id].formType);
      if (
        req[req.params.id].formType === 'normal' &&
        req.body.discrepancyFormId
      ) {
        reqUtils.existSource('discrepancyFormId', 'body', ReleasedForm)(
          req,
          res,
          next
        );
      } else {
        next();
      }
    },
    // check the discrepancy form type
    function(req, res, next) {
      debug(req[req.body.discrepancyFormId]);
      if (
        req[req.body.discrepancyFormId] &&
        req[req.body.discrepancyFormId].formType !== 'discrepancy'
      ) {
        return res
          .status(400)
          .send(
            `${req[req.body.discrepancyFormId].id} is not a discrepancy form`
          );
      }

      if (
        req[req.body.discrepancyFormId] &&
        req[req.body.discrepancyFormId].status !== 1
      ) {
        return res
          .status(400)
          .send(`${req[req.body.discrepancyFormId].id} is not released`);
      }
      return next();
    },
    async function releaseForm(req, res) {
      const releasedForm = {};
      const form = req[req.params.id];
      const discrepancyForm = req[req.body.discrepancyFormId];
      releasedForm.title = req.body.title || form.title;
      releasedForm.description = req.body.description || form.description;
      releasedForm.tags = form.tags;
      releasedForm.formType = form.formType;
      releasedForm.base = new FormContent(form);
      releasedForm.ver = `${releasedForm.base._v}`;
      if (discrepancyForm) {
        // update formType
        releasedForm.formType = 'normal_discrepancy';
        releasedForm.discrepancy = discrepancyForm.base;
        releasedForm.ver += `:${discrepancyForm.base._v}`;
      }
      releasedForm.releasedBy = req.session.userid;
      releasedForm.releasedOn = Date.now();

      // check if there is already a released form with the same name and
      // version
      try {
        const existingForm = await ReleasedForm.findOne({
          title: releasedForm.title,
          formType: releasedForm.formType,
          ver: releasedForm.ver,
          // only search the active released form, not archived
          // remove this condition if including the archive released form
          status: 1,
        });
        debug(`find existing form: ${existingForm}`);
        if (existingForm) {
          return res
            .status(400)
            .send(
              `A form with same title, type, and version was already released in ${existingForm._id}.`
            );
        }
        const saveForm = await new ReleasedForm(releasedForm).save();
        const url = `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/released-forms/${saveForm._id}/`;
        return res.status(201).json({
          location: url,
        });
      } catch (error) {
        return res.status(500).send(error.message);
      }
    }
  );

  app.put(
    '/forms/:id/status',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.filter('body', ['status', 'version']),
    reqUtils.hasAll('body', ['status', 'version']),
    reqUtils.canWriteMw('id'),
    async function updateStatus(req, res) {
      const f = req[req.params.id];
      const s = req.body.status;
      const v = req.body.version;

      if ([0, 0.5, 1, 2].indexOf(s) === -1) {
        return res.status(400).send('invalid status');
      }

      if (v !== f._v) {
        return res.status(400).send(`the current version is ${f._v}`);
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
      f.updatedBy = req.session.userid;
      f.updatedOn = Date.now();
      // check if we need to increment the version
      // in this case, no
      f.incrementVersion();
      try {
        await f.saveWithHistory(req.session.userid);
        return res.status(200).send(`status updated to ${s}`);
      } catch (error) {
        return res.status(500).send(error.message);
      }
    }
  );
};
