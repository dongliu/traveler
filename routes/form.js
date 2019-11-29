var config = require('../config/config.js');
var auth = require('../lib/auth');
var authConfig = config.auth;

var mongoose = require('mongoose');
var path = require('path');
var _ = require('lodash');
var routesUtilities = require('../utilities/routes.js');
var reqUtils = require('../lib/req-utils');
var shareLib = require('../lib/share');
var tag = require('../lib/tag');
var FormError = require('../lib/error').FormError;
var formModel = require('../model/form');

var Form = mongoose.model('Form');
var FormFile = mongoose.model('FormFile');
const ReleasedForm = mongoose.model('ReleasedForm');
const FormContent = mongoose.model('FormContent');
var User = mongoose.model('User');
var Group = mongoose.model('Group');

var debug = require('debug')('traveler:route:form');
var logger = require('../lib/loggers').getLogger();

module.exports = function(app) {
  app.get('/forms/', auth.ensureAuthenticated, function(req, res) {
    res.render('forms', routesUtilities.getRenderObject(req));
  });

  app.get('/forms/json', auth.ensureAuthenticated, function(req, res) {
    Form.find(
      {
        createdBy: req.session.userid,
        archived: {
          $ne: true,
        },
        status: {
          $ne: 2,
        },
        owner: {
          $exists: false,
        },
      },
      'title formType status tags mapping createdBy createdOn updatedBy updatedOn publicAccess sharedWith sharedGroup _v'
    ).exec(function(err, forms) {
      if (err) {
        logger.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get('/transferredforms/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    Form.find(
      {
        owner: req.session.userid,
        archived: {
          $ne: true,
        },
      },
      'title formType status tags createdBy createdOn updatedBy updatedOn transferredOn publicAccess sharedWith sharedGroup'
    ).exec(function(err, forms) {
      if (err) {
        logger.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get('/allforms/json', auth.ensureAuthenticated, function(req, res) {
    if (routesUtilities.checkUserRole(req, 'read_all_forms')) {
      Form.find(
        {},
        'title formType status tags createdBy createdOn updatedBy updatedOn sharedWith sharedGroup'
      )
        .lean()
        .exec(function(err, forms) {
          if (err) {
            logger.error(err);
            return res.status(500).send(err.message);
          }
          res.status(200).json(forms);
        });
    } else {
      res.status(200).json('You are not authorized to view all forms.');
    }
  });

  app.get('/sharedforms/json', auth.ensureAuthenticated, function(req, res) {
    User.findOne(
      {
        _id: req.session.userid,
      },
      'forms'
    ).exec(function(err, me) {
      if (err) {
        logger.error(err);
        return res.status(500).send(err.message);
      }
      if (!me) {
        return res.status(400).send('cannot identify the current user');
      }
      Form.find(
        {
          _id: {
            $in: me.forms,
          },
          archived: {
            $ne: true,
          },
        },
        'title formType status tags owner updatedBy updatedOn publicAccess sharedWith sharedGroup'
      ).exec(function(fErr, forms) {
        if (fErr) {
          logger.error(fErr);
          return res.status(500).send(fErr.message);
        }
        res.status(200).json(forms);
      });
    });
  });

  app.get('/groupsharedforms/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    Group.find(
      {
        _id: {
          $in: req.session.memberOf,
        },
      },
      'forms'
    ).exec(function(err, groups) {
      if (err) {
        logger.error(err);
        return res.status(500).send(err.message);
      }
      var formids = [];
      var i;
      var j;
      // merge the forms arrays
      for (i = 0; i < groups.length; i += 1) {
        for (j = 0; j < groups[i].forms.length; j += 1) {
          if (formids.indexOf(groups[i].forms[j]) === -1) {
            formids.push(groups[i].forms[j]);
          }
        }
      }
      Form.find(
        {
          _id: {
            $in: formids,
          },
          archived: {
            $ne: true,
          },
        },
        'title formType status tags owner updatedBy updatedOn publicAccess sharedWith sharedGroup'
      ).exec(function(fErr, forms) {
        if (fErr) {
          logger.error(fErr);
          return res.status(500).send(fErr.message);
        }
        res.status(200).json(forms);
      });
    });
  });

  app.get('/archivedforms/json', auth.ensureAuthenticated, function(req, res) {
    var search = {
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
    Form.find(search, 'title formType status tags updatedBy updatedOn _v').exec(
      function(err, forms) {
        if (err) {
          logger.error(err);
          return res.status(500).send(err.message);
        }
        res.status(200).json(forms);
      }
    );
  });

  app.get('/publicforms/', auth.ensureAuthenticated, function(req, res) {
    res.render('public-forms', routesUtilities.getRenderObject(req));
  });

  app.get('/publicforms/json', auth.ensureAuthenticated, function(req, res) {
    Form.find({
      publicAccess: {
        $in: [0, 1],
      },
      archived: {
        $ne: true,
      },
    }).exec(function(err, forms) {
      if (err) {
        logger.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(forms);
    });
  });

  app.get('/forms/new', auth.ensureAuthenticated, function(req, res) {
    return res.render('form-new', routesUtilities.getRenderObject(req));
  });

  app.get(
    '/forms/:id/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    function formBuilder(req, res) {
      var form = req[req.params.id];
      var access = reqUtils.getAccess(req, form);

      if (access === -1) {
        return res
          .status(403)
          .send('you are not authorized to access this resource');
      }

      if (form.archived) {
        return res.redirect(
          (req.proxied ? authConfig.proxied_service : authConfig.service) +
            '/forms/' +
            req.params.id +
            '/preview'
        );
      }

      if (access === 1) {
        return res.render(
          'form-builder',
          routesUtilities.getRenderObject(req, {
            id: req.params.id,
            title: form.title,
            html: form.html,
            status: form.status,
            statusText: formModel.statusMap['' + form.status],
            _v: form._v,
            formType: form.formType,
            prefix: req.proxied ? req.proxied_prefix : '',
          })
        );
      }

      return res.redirect(
        (req.proxied ? authConfig.proxied_service : authConfig.service) +
          '/forms/' +
          req.params.id +
          '/preview'
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

  app.post(
    '/forms/:id/uploads/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canWriteMw('id'),
    function(req, res) {
      var doc = req[req.params.id];
      if (_.isEmpty(req.files)) {
        return res.status(400).send('Expect One uploaded file');
      }

      if (!req.body.name) {
        return res.status(400).send('Expect input name');
      }

      var file = new FormFile({
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

      file.save(function(saveErr, newfile) {
        if (saveErr) {
          logger.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        var url =
          (req.proxied ? authConfig.proxied_service : authConfig.service) +
          '/formfiles/' +
          newfile.id;
        res.set('Location', url);
        return res
          .status(201)
          .send(
            'The uploaded file is at <a target="_blank" href="' +
              url +
              '">' +
              url +
              '</a>'
          );
      });
    }
  );

  app.get(
    '/formfiles/:id',
    auth.ensureAuthenticated,
    reqUtils.exist('id', FormFile),
    function(req, res) {
      var data = req[req.params.id];
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
      var form = req[req.params.id];
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
      var doc = req[req.params.id];
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
      var form = req[req.params.id];
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

  app.put(
    '/forms/:id/share/public',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['access']),
    function(req, res) {
      var form = req[req.params.id];
      // change the access
      var access = req.body.access;
      if (['-1', '0', '1'].indexOf(access) === -1) {
        return res.status(400).send('not valid value');
      }
      access = Number(access);
      if (form.publicAccess === access) {
        return res.status(204).send();
      }
      form.publicAccess = access;
      form.save(function(saveErr) {
        if (saveErr) {
          logger.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res
          .status(200)
          .send('public access is set to ' + req.body.access);
      });
    }
  );

  app.get(
    '/forms/:id/share/:list/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      var form = req[req.params.id];
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
      var form = req[req.params.id];
      var share = -2;
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
              req.body.id + ' is already in the ' + req.params.list + ' list.'
          );
      }

      if (share === -1) {
        // new user
        shareLib.addShare(req, res, form);
      }
    }
  );

  app.put(
    '/forms/:id/share/:list/:shareid',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['access']),
    function(req, res) {
      var form = req[req.params.id];
      var share;
      if (req.params.list === 'users') {
        share = form.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = form.sharedGroup.id(req.params.shareid);
      }
      if (!share) {
        return res
          .status(400)
          .send('cannot find ' + req.params.shareid + ' in the list.');
      }
      // change the access
      if (req.body.access === 'write') {
        share.access = 1;
      } else if (req.body.access === 'read') {
        share.access = 0;
      } else {
        return res
          .status(400)
          .send('cannot take the access ' + req.body.access);
      }
      form.save(function(saveErr) {
        if (saveErr) {
          logger.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        // check consistency of user's form list
        var Target;
        if (req.params.list === 'users') {
          Target = User;
        }
        if (req.params.list === 'groups') {
          Target = Group;
        }
        Target.findByIdAndUpdate(
          req.params.shareid,
          {
            $addToSet: {
              forms: form._id,
            },
          },
          function(updateErr, target) {
            if (updateErr) {
              logger.error(updateErr);
            }
            if (!target) {
              logger.error(
                'The user/group ' + req.params.userid + ' is not in the db'
              );
            }
          }
        );
        return res.status(200).json(share);
      });
    }
  );

  app.delete(
    '/forms/:id/share/:list/:shareid',
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    auth.ensureAuthenticated,
    function(req, res) {
      var form = req[req.params.id];
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
        req['body'].hasOwnProperty('formType') &&
        req['body']['formType'] == 'discrepancy'
      );
    }, 'admin'),
    reqUtils.sanitize('body', ['html']),
    function(req, res) {
      var html = req.body.html || '';
      formModel.createForm(
        {
          title: req.body.title,
          formType: req.body.formType,
          createdBy: req.session.userid,
          html: html,
        },
        function(err, newform) {
          if (err) {
            logger.error(err);
            return res.status(500).send(err.message);
          }
          var url =
            (req.proxied ? authConfig.proxied_service : authConfig.service) +
            '/forms/' +
            newform.id +
            '/';

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
      var doc = req[req.params.id];
      var form = {};
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

  app.put(
    '/forms/:id/archived',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['archived']),
    function(req, res) {
      var doc = req[req.params.id];
      if (doc.archived === req.body.archived) {
        return res.status(204).send();
      }

      doc.archived = req.body.archived;
      if (doc.archived) {
        doc.archivedOn = Date.now();
      }

      doc.save(function(saveErr, newDoc) {
        if (saveErr) {
          logger.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res
          .status(200)
          .send(
            'Form ' +
              req.params.id +
              ' archived state set to ' +
              newDoc.archived
          );
      });
    }
  );

  app.put(
    '/forms/:id/owner',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['name']),
    function(req, res) {
      var doc = req[req.params.id];
      shareLib.changeOwner(req, res, doc);
    }
  );

  app.put(
    '/forms/:id/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Form),
    reqUtils.canWriteMw('id'),
    reqUtils.status('id', [0]),
    reqUtils.filter('body', ['html', 'title', 'description']),
    reqUtils.sanitize('body', ['html', 'title', 'description']),
    function(req, res) {
      if (!req.is('json')) {
        return res.status(415).send('json request expected');
      }
      var doc = req[req.params.id];
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
      doc
        .saveWithHistory(req.session.userid)
        .then(function(newDoc) {
          return res.json(newDoc);
        })
        .catch(function(saveErr) {
          if (saveErr) {
            logger.error(saveErr.message);
            if (saveErr instanceof FormError) {
              return res.status(saveErr.status).send(saveErr.message);
            }
            return res.status(500).send(saveErr.message);
          }
        });
    }
  );

  // add tag routines
  tag.addTag(app, '/forms/:id/tags/', Form);
  tag.removeTag(app, '/forms/:id/tags/:tag', Form);

  app.put(
    '/forms/:id/released',
    auth.ensureAuthenticated,
    // only admin or manager can release a form
    auth.verifyRole('admin', 'manager'),
    // find the unreleased form
    reqUtils.exist('id', Form),
    // the form was submitted for release
    function(req, res, next) {
      if (req[req.params.id].status !== 0.5) {
        return res
          .status(400)
          .send(`${req[req.params.id].id} is not submitted for release`);
      }
      next();
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
      next();
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
      // reset the submitted form
      form.status = 0;
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
        debug('find existing form: ' + existingForm);
        if (existingForm) {
          return res
            .status(400)
            .send(
              `A form with same title, type, and version was already released in ${
                existingForm._id
              }.`
            );
        }
      } catch (error) {
        return res.status(500).send(error.message);
      }

      try {
        const saveForm = await new ReleasedForm(releasedForm).save();
        const url = `/released-forms/${saveForm._id}/`;
        form.save();
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
    function updateStatus(req, res) {
      var f = req[req.params.id];
      var s = req.body.status;
      var v = req.body.version;

      if ([0, 0.5, 1, 2].indexOf(s) === -1) {
        return res.status(400).send('invalid status');
      }

      if (v !== f._v) {
        return res.status(400).send('the current version is ' + f._v);
      }

      // no change
      if (f.status === s) {
        return res.status(204).send();
      }

      var stateTransition = require('../model/form').stateTransition;

      var target = _.find(stateTransition, function(t) {
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
      f.saveWithHistory(req.session.userid)
        .then(function() {
          return res.status(200).send('status updated to ' + s);
        })
        .catch(function(err) {
          return res.status(500).send(err.message);
        });
    }
  );
};
