/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/
var config = require('../config/config.js');

var routesUtilities = require('../utilities/routes.js');

var fs = require('fs');
var auth = require('../lib/auth');
var authConfig = config.auth;
var mongoose = require('mongoose');
var path = require('path');
var _ = require('underscore');
var reqUtils = require('../lib/req-utils');
var shareLib = require('../lib/share');
var tag = require('../lib/tag');
var DataError = require('../lib/error').DataError;


var Form = mongoose.model('Form');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerNote = mongoose.model('TravelerNote');

function addInputName(name, list) {
  if (list.indexOf(name) === -1) {
    list.push(name);
  }
}

function resetTouched(doc, cb) {
  TravelerData.find({
    _id: {
      $in: doc.data
    }
  }, 'name').exec(function (dataErr, data) {
    if (dataErr) {
      console.error(dataErr);
      return cb(dataErr);
    }
    // reset the touched input name list and the finished input number
    console.info('reset the touched inputs for traveler ' + doc._id);
    var labels = {};
    var activeForm;
    if (doc.forms.length === 1) {
      activeForm = doc.forms[0];
    } else {
      activeForm = doc.forms.id(doc.activeForm);
    }

    if (!(activeForm.labels && _.size(activeForm.labels) > 0)) {
      activeForm.labels = routesUtilities.traveler.inputLabels(activeForm.html);
    }
    labels = activeForm.labels;
    // empty the current touched input list
    doc.touchedInputs = [];
    data.forEach(function (d) {
      // check if the data is for the active form
      if (labels.hasOwnProperty(d.name)) {
        addInputName(d.name, doc.touchedInputs);
      }
    });
    // finished input
    doc.finishedInput = doc.touchedInputs.length;
    cb();
  });
}

function updateFinished(doc, cb) {
  var beforeUpdate = doc.finishedInput;
  var touched = doc.touchedInputs.length;
  if (touched === beforeUpdate + 1) {
    doc.finishedInput = touched;
    return cb();
  }
  // need a reset
  resetTouched(doc, cb);
}

function createTraveler(form, req, res) {

  routesUtilities.traveler.createTraveler(form, form.title, req.session.userid, [], function (err, doc) {
      if (err) {
          console.error(err);
          return res.status(500).send(err.message);
      }
      console.log('new traveler ' + doc.id + ' created');
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + doc.id + '/';
      res.set('Location', url);
      return res.status(201).json({
          location: (req.proxied ? req.proxied_prefix : '') + '/travelers/' + doc.id + '/'
      })
  });
}

function cloneTraveler(source, req, res) {
  var traveler = new Traveler({
    title: source.title + ' clone',
    description: source.description,
    devices: [],
    tags: source.tags,
    status: 1,
    createdBy: req.session.userid,
    createdOn: Date.now(),
    clonedBy: req.session.userid,
    clonedFrom: source._id,
    sharedWith: source.sharedWith,
    sharedGroup: source.sharedGroup,
    referenceForm: source.referenceForm,
    forms: source.forms,
    activeForm: source.activeForm,
    mapping: source.mapping,
    data: [],
    comments: [],
    totalInput: source.totalInput,
    finishedInput: 0
  });

  traveler.save(function (err, doc) {
    if (err) {
      console.error(err);
      return res.status(500).send(err.message);
    }
    console.log('new traveler ' + doc.id + ' created');
    doc.sharedWith.forEach(function (e) {
      User.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (userErr, user) {
        if (userErr) {
          console.error(userErr);
        }
        if (!user) {
          console.error('The user ' + e._id + ' does not in the db');
        }
      });
    });

    doc.sharedGroup.forEach(function (e) {
      Group.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (groupErr, user) {
        if (groupErr) {
          console.error(groupErr);
        }
        if (!user) {
          console.error('The group ' + e._id + ' does not in the db');
        }
      });
    });

    var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + doc.id + '/';
    res.set('Location', url);
    return res.status(201).json({
      location: url
    });
  });
}

module.exports = function (app) {

  app.get('/travelers/', auth.ensureAuthenticated, function (req, res) {
    res.render('travelers', routesUtilities.getRenderObject(req));
  });

  app.get('/travelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      createdBy: req.session.userid,
      archived: {
        $ne: true
      },
      owner: {
        $exists: false
      }
    }, 'title description status devices tags sharedWith sharedGroup publicAccess locations createdOn deadline updatedOn updatedBy manPower finishedInput totalInput mapping').lean().exec(function (err, docs) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      return res.status(200).json(docs);
    });
  });

  app.get('/transferredtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      owner: req.session.userid,
      archived: {
        $ne: true
      }
    }, 'title description status devices tags sharedWith sharedGroup publicAccess locations createdOn transferredOn deadline updatedOn updatedBy manPower finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(travelers);
    });
  });

  app.get('/sharedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'travelers').exec(function (err, me) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (!me) {
        return res.status(400).send('cannot identify the current user');
      }
      Traveler.find({
        _id: {
          $in: me.travelers
        },
        archived: {
          $ne: true
        }
      }, 'title description status devices tags locations createdBy createdOn owner deadline updatedBy updatedOn sharedWith sharedGroup publicAccess manPower finishedInput totalInput').lean().exec(function (tErr, travelers) {
        if (tErr) {
          console.error(tErr);
          return res.status(500).send(tErr.message);
        }
        return res.status(200).json(travelers);
      });
    });
  });

  app.get('/groupsharedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Group.find({
      _id: {
        $in: req.session.memberOf
      }
    }, 'travelers').exec(function (err, groups) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      var travelerIds = [];
      var i;
      var j;
      // merge the travelers arrays
      for (i = 0; i < groups.length; i += 1) {
        for (j = 0; j < groups[i].travelers.length; j += 1) {
          if (travelerIds.indexOf(groups[i].travelers[j]) === -1) {
            travelerIds.push(groups[i].travelers[j]);
          }
        }
      }
      Traveler.find({
        _id: {
          $in: travelerIds
        }
      }, 'title description status devices tags locations createdBy createdOn owner deadline updatedBy updatedOn sharedWith sharedGroup publicAccess manPower finishedInput totalInput').lean().exec(function (tErr, travelers) {
        if (tErr) {
          console.error(tErr);
          return res.status(500).send(tErr.message);
        }
        res.status(200).json(travelers);
      });
    });
  });

  app.get('/publictravelers/', auth.ensureAuthenticated, function (req, res) {
    res.render('public-travelers', routesUtilities.getRenderObject(req));
  });

  app.get('/publictravelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      publicAccess: {
        $in: [0, 1]
      },
      archived: {
        $ne: true
      }
    }).exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(travelers);
    });
  });

  /*  app.get('/currenttravelers/json', auth.ensureAuthenticated, function (req, res) {
      var search = {
        archived: {
          $ne: true
        }
      };
      if (req.query.hasOwnProperty('device')) {
        search.devices = {
          $in: [req.query.device]
        };
      }
      Traveler.find(search, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith sharedGroup finishedInput totalInput').lean().exec(function (err, travelers) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        return res.status(200).json(travelers);
      });
    });

    app.get('/currenttravelersinv1/json', auth.ensureAuthenticated, function (req, res) {
      var fullurl = config.legacy_traveler.travelers;
      if (req.query.hasOwnProperty('device')) {
        fullurl = config.legacy_traveler.devices + req.query.device;
      }
      request({
        strictSSL: false,
        url: fullurl
      }).pipe(res);
    });

    app.get('/currenttravelers/', auth.ensureAuthenticated, function (req, res) {
      return res.render('currenttravelers', {
        device: req.query.device || null
      });
    });*/

  app.get('/archivedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    var search = {
      $and: [{
        $or: [{
          createdBy: req.session.userid,
          owner: {
            $exists: false
          }
        }, {
          owner: req.session.userid
        }]
      }, {
        archived: true
      }]
    };
    Traveler.find(search, 'title description status devices locations archivedOn updatedBy updatedOn deadline sharedWith sharedGroup manPower finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      return res.status(200).json(travelers);
    });
  });

  app.post('/travelers/', auth.ensureAuthenticated, reqUtils.filter('body', ['form', 'source']), function (req, res) {
    if (req.body.form) {
      Form.findById(req.body.form, function (err, form) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        if (form) {
          createTraveler(form, req, res);
        } else {
          return res.status(400).send('cannot find the form ' + req.body.form);
        }
      });
    }
    if (req.body.source) {
      Traveler.findById(req.body.source, function (err, traveler) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        if (traveler) {
          // if (traveler.status === 0) {
          //   return res.status(400).send('You cannot clone an initialized traveler.');
          // }
          if (reqUtils.canRead(req, traveler)) {
            cloneTraveler(traveler, req, res);
          } else {
            return res.status(400).send('You cannot clone a traveler that you cannot read.');
          }
        } else {
          return res.status(400).send('cannot find the traveler ' + req.body.source);
        }
      });
    }
  });

  app.get('/travelers/:id/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), function (req, res) {
    var doc = req[req.params.id];
    if (doc.archived) {
      return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + req.params.id + '/view');
    }

    if (reqUtils.canWrite(req, doc)) {
      routesUtilities.getDeviceValue(doc.devices).then(function (value) {
        doc.devices = value;
        return res.render('traveler', routesUtilities.getRenderObject(req, {
          isOwner: reqUtils.isOwner(req, doc),
          traveler: doc,
          formHTML: doc.forms.length === 1 ? doc.forms[0].html : doc.forms.id(doc.activeForm).html
        }));
      });
    } else if (reqUtils.canRead(req, doc)) {
      return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + req.params.id + '/view');
    } else {
      return res.status(403).send('You are not authorized to access this resource');
    }
  });

  app.get('/travelers/:id/view', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), function (req, res) {
    var doc = req[req.params.id];
    routesUtilities.getDeviceValue(doc.devices).then(function (value) {
      res.devices = value;
      return res.render('traveler-viewer', routesUtilities.getRenderObject(req, {
        traveler: req[req.params.id]
      }));
    });
  });


  app.get('/travelers/:id/json', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    return res.status(200).json(_.pick(req[req.params.id], 'id', 'title', 'status', 'tags', 'devices', 'mapping', 'data'));
  });

  /**
   * get the latest value for the given name from the data list
   * @param  {String} name input name
   * @param  {Array} data an arrya of TravelerData
   * @return {Number|String|null}      the value for the given name
   */
  function dataForName(name, data) {
    if (!name) {
      return null;
    }
    if (_.isEmpty(data)) {
      return null;
    }

    var found = data.filter(function (d) {
      return d.name === name;
    });
    // get the latest value from history
    if (found.length) {
      found.sort(function (a, b) {
        if (a.inputOn > b.inputOn) {
          return -1;
        }
        return 1;
      });
      return found[0].value;
    }
    return null;
  }

  /**
   * retrieve the json representation of the traveler including the properties
   * in the give list, and the key-value's in the mapping
   * @param  {Traveler} traveler the traveler mongoose object
   * @param  {Array} props    the list of properties to be included
   * @param  {Function} cb    callback function
   * @return {Object}         the json representation
   */
  function retrieveKeyvalue(traveler, props, cb) {
    var output = {};
    props.forEach(function (p) {
      output[p] = traveler[p];
    });
    var mapping = traveler.mapping;
    TravelerData.find({
      _id: {
        $in: traveler.data
      }
    }, 'name value inputOn inputType').exec(function (dataErr, docs) {
      if (dataErr) {
        return cb(dataErr);
      }
      var userDefined = {};
      _.mapObject(mapping, function (name, key) {
        userDefined[key] = dataForName(name, docs);
      });
      output.user_defined = userDefined;
      return cb(null, output);
    });
  }

  /**
   * retrieve the json representation of the traveler including the properties
   * in the give list, and the {key, label, value}'s in the mapping
   * @param  {Traveler} traveler the traveler mongoose object
   * @param  {Array} props    the list of properties to be included
   * @param  {Function} cb    callback function
   * @return {Object}         the json representation
   */
  function retrieveKeyLableValue(traveler, props, cb) {
    var output = {};
    props.forEach(function (p) {
      output[p] = traveler[p];
    });
    var mapping = traveler.mapping;
    var labels = traveler.labels;
    TravelerData.find({
      _id: {
        $in: traveler.data
      }
    }, 'name value inputOn inputType').exec(function (dataErr, docs) {
      if (dataErr) {
        return cb(dataErr);
      }
      var userDefined = {};
      _.mapObject(mapping, function (name, key) {
        userDefined[key] = {};
        userDefined[key].value = dataForName(name, docs);
        if (_.isObject(labels)) {
          userDefined[key].label = labels[name];
        }
      });
      output.user_defined = userDefined;
      return cb(null, output);
    });
  }

  app.get('/travelers/:id/keyvalue/json', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    retrieveKeyvalue(req[req.params.id], ['id', 'title', 'status', 'tags', 'devices'], function (err, output) {
      if (err) {
        return res.status(500).send(err.message);
      }
      return res.status(200).json(output);
    });
  });

  app.get('/travelers/:id/keylabelvalue/json', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    retrieveKeyLableValue(req[req.params.id], ['id', 'title', 'status', 'tags', 'devices'], function (err, output) {
      if (err) {
        return res.status(500).send(err.message);
      }
      return res.status(200).json(output);
    });
  });

  app.put('/travelers/:id/archived', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['archived']), function (req, res) {
    var doc = req[req.params.id];
    if (doc.archived === req.body.archived) {
      return res.status(204).send();
    }

    doc.archived = req.body.archived;

    if (doc.archived) {
      doc.archivedOn = Date.now();
    }

    doc.save(function (saveErr, newDoc) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(200).send('traveler ' + req.params.id + ' archived state set to ' + newDoc.archived);
    });
  });

  app.put('/travelers/:id/owner', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.status('id', [0, 1, 1.5]), reqUtils.filter('body', ['name']), function (req, res) {
    var doc = req[req.params.id];
    shareLib.changeOwner(req, res, doc);
  });

  app.get('/travelers/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), function (req, res) {
    var doc = req[req.params.id];
    return res.render('traveler-config', routesUtilities.getRenderObject(req, {
      traveler: doc,
      isOwner: reqUtils.isOwner(req, doc)
    }));
  });

  app.get('/travelers/:id/formmanager', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), function formviewer(req, res) {
    res.render('form-manager', routesUtilities.getRenderObject(req, {
      traveler: req[req.params.id]
    }));
  });

  // use the form in the request as the active form
  app.post('/travelers/:id/forms/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['formId']), reqUtils.hasAll('body', ['formId']), reqUtils.existSource('formId', 'body', Form), function addForm(req, res) {
    var doc = req[req.params.id];
    var form = {
      html: req[req.body.formId].html,
      mapping: req[req.body.formId].mapping,
      labels: req[req.body.formId].labels,
      activatedOn: [Date.now()],
      reference: req.body.formId,
      alias: req[req.body.formId].title
    };

    // for old forms without lables
    if (!(typeof form.labels === 'object' && _.size(form.labels) > 0)) {
      form.labels = routesUtilities.traveler.inputLabels(form.html);
    }

    var num = _.size(form.labels);
    doc.forms.push(form);
    doc.activeForm = doc.forms[doc.forms.length - 1]._id;
    doc.mapping = form.mapping;
    doc.labels = form.labels;
    doc.totalInput = num;
    // reset touched input list
    resetTouched(doc, function () {
      doc.save(function saveDoc(e, newDoc) {
        if (e) {
          console.error(e);
          return res.status(500).send(e.message);
        }
        return res.status(200).json(newDoc);
      });
    });
  });

  // set active form
  app.put('/travelers/:id/forms/active', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['formId']), reqUtils.hasAll('body', ['formId']), function putActiveForm(req, res) {
    var doc = req[req.params.id];
    var formId = req.body.formId;
    var form = doc.forms.id(formId);

    if (!form) {
      return res.status(410).send('Cannot find form ' + req.body.formId + ' in traveler ' + req[req.params.id]);
    }

    doc.activeForm = form._id;
    doc.mapping = form.mapping;
    // for old forms without lables
    if (!(typeof form.labels === 'object' && _.size(form.labels) > 0)) {
      form.labels = routesUtilities.traveler.inputLabels(form.html);
    }
    doc.labels = form.labels;
    doc.totalInput = _.size(form.labels);
    form.activatedOn.push(Date.now());
    // reset touched input list
    resetTouched(doc, function () {
      doc.save(function saveDoc(e, newDoc) {
        if (e) {
          console.error(e);
          return res.status(500).send(e.message);
        }
        return res.status(200).json(newDoc);
      });
    });
  });

  // set form alias
  app.put('/travelers/:id/forms/:fid/alias', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['value']), reqUtils.sanitize('body', ['value']), function putFormAlias(req, res) {
    var doc = req[req.params.id];
    if (doc.status > 1 || doc.archived) {
      return res.status(400).send('cannot update form because of current traveler state');
    }
    var form = doc.forms.id(req.params.fid);
    if (!form) {
      return res.status(410).send('from ' + req.params.fid + ' not found.');
    }

    form.alias = req.body.value;

    doc.save(function saveDoc(e) {
      if (e) {
        console.error(e);
        return res.status(500).send(e.message);
      }
      return res.status(204).send();
    });
  });

  app.put('/travelers/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['title', 'description', 'deadline']), reqUtils.sanitize('body', ['title', 'description', 'deadline']), function (req, res) {
    var doc = req[req.params.id];
    var k;
    for (k in req.body) {
      if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
        doc[k] = req.body[k];
      }
    }
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.save(function (saveErr, newDoc) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      var out = {};
      for (k in req.body) {
        if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
          out[k] = newDoc.get(k);
        }
      }
      return res.status(200).json(out);
    });
  });

  app.put('/travelers/:id/status', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), reqUtils.archived('id', false), function (req, res) {
    var doc = req[req.params.id];

    if ([1, 1.5, 2, 3].indexOf(req.body.status) === -1) {
      return res.status(400).send('invalid status');
    }

    if (doc.status === req.body.status) {
      return res.status(204).send();
    }

    if (req.body.status !== 1.5 && !reqUtils.isOwner(req, doc)) {
      return res.status(403).send('You are not authorized to change the status. ');
    }

    if (req.body.status === 1) {
      if ([0, 1.5, 3].indexOf(doc.status) !== -1) {
        doc.status = 1;
      } else {
        return res.status(400).send('cannot start to work from the current status. ');
      }
    }

    if (req.body.status === 1.5) {
      if ([1].indexOf(doc.status) !== -1) {
        doc.status = 1.5;
      } else {
        return res.status(400).send('cannot complete from the current status. ');
      }
    }

    if (req.body.status === 2) {
      if ([1.5].indexOf(doc.status) !== -1) {
        doc.status = 2;
      } else {
        return res.status(400).send('cannot complete from the current status. ');
      }
    }

    if (req.body.status === 3) {
      if ([1].indexOf(doc.status) !== -1) {
        doc.status = 3;
      } else {
        return res.status(400).send('cannot freeze from the current status. ');
      }
    }

    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(200).send('status updated to ' + req.body.status);
    });
  });

  // add tag routines
  tag.addTag(app, '/travelers/:id/tags/', Traveler);
  tag.removeTag(app, '/travelers/:id/tags/:tag', Traveler);

  app.post('/travelers/:id/devices/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['newdevice']), reqUtils.sanitize('body', ['newdevice']), function (req, res) {
    var newdevice = req.body.newdevice;
    if (!newdevice) {
      return res.status(400).send('the new device name not accepted');
    }
    var doc = req[req.params.id];
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    var added = doc.devices.addToSet(newdevice);
    if (added.length === 0) {
      return res.status(204).send();
    }
    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(200).json({
        device: newdevice
      });
    });
  });

  app.delete('/travelers/:id/devices/:number', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), reqUtils.status('id', [0, 1]), function (req, res) {
    var doc = req[req.params.id];
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.devices.pull(req.params.number);
    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(204).send();
    });
  });

  app.get('/travelers/:id/data/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    var doc = req[req.params.id];
    TravelerData.find({
      _id: {
        $in: doc.data
      }
    }, 'name value inputType inputBy inputOn').exec(function (dataErr, docs) {
      if (dataErr) {
        console.error(dataErr);
        return res.status(500).send(dataErr.message);
      }
      return res.status(200).json(docs);
    });
  });

  app.post('/travelers/:id/data/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.archived('id', false), reqUtils.canWriteMw('id'), reqUtils.status('id', [1]), reqUtils.filter('body', ['name', 'value', 'type']), reqUtils.hasAll('body', ['name', 'value', 'type']), reqUtils.sanitize('body', ['name', 'value', 'type']), function (req, res) {
    var doc = req[req.params.id];
    var data = new TravelerData({
      traveler: doc._id,
      name: req.body.name,
      value: req.body.value,
      inputType: req.body.type,
      inputBy: req.session.userid,
      inputOn: Date.now()
    });
    data.save(function (dataErr) {
      if (dataErr) {
        console.error(dataErr.message);
        if (dataErr instanceof DataError) {
          return res.status(dataErr.status).send(dataErr.message);
        }
        return res.status(500).send(dataErr.message);
      }
      doc.manPower.addToSet({
        _id: req.session.userid,
        username: req.session.username
      });
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.data.push(data._id);
      // update touched input, and finished input here
      addInputName(data.name, doc.touchedInputs);
      // update the finishe input number
      updateFinished(doc, function () {
        // save doc anyway
        doc.save(function (saveErr) {
          if (saveErr) {
            console.error(saveErr);
            return res.status(500).send(saveErr.message);
          }
          return res.status(204).send();
        });
      });
    });
  });

  app.get('/travelers/:id/notes/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canReadMw('id'), function (req, res) {
    var doc = req[req.params.id];
    TravelerNote.find({
      _id: {
        $in: doc.notes
      }
    }, 'name value inputBy inputOn').exec(function (noteErr, docs) {
      if (noteErr) {
        console.error(noteErr);
        return res.status(500).send(noteErr.message);
      }
      return res.status(200).json(docs);
    });
  });

  app.post('/travelers/:id/notes/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.archived('id', false), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['name', 'value']), reqUtils.hasAll('body', ['name', 'value']), reqUtils.sanitize('body', ['name', 'value']), function (req, res) {
    var doc = req[req.params.id];
    var note = new TravelerNote({
      traveler: doc._id,
      name: req.body.name,
      value: req.body.value,
      inputBy: req.session.userid,
      inputOn: Date.now()
    });
    note.save(function (noteErr) {
      if (noteErr) {
        console.error(noteErr);
        return res.status(500).send(noteErr.message);
      }
      doc.notes.push(note._id);
      doc.manPower.addToSet({
        _id: req.session.userid,
        username: req.session.username
      });
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res.status(204).send();
      });
    });
  });

  app.post('/travelers/:id/uploads/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.canWriteMw('id'), reqUtils.status('id', [1]), function (req, res) {
    var doc = req[req.params.id];

    if (_.isEmpty(req.files)) {
      return res.status(400).send('Expecte One uploaded file');
    }

    var data = new TravelerData({
      traveler: doc._id,
      name: req.body.name,
      value: req.files[req.body.name].originalname,
      file: {
        path: req.files[req.body.name].path,
        encoding: req.files[req.body.name].encoding,
        mimetype: req.files[req.body.name].mimetype
      },
      inputType: req.body.type,
      inputBy: req.session.userid,
      inputOn: Date.now()
    });

    data.save(function (dataErr) {
      if (dataErr) {
        console.error(dataErr);
        return res.status(500).send(dataErr.message);
      }
      doc.data.push(data._id);
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/data/' + data._id;
        res.set('Location', url);
        return res.status(201).json({
          location: url
        });
      });
    });
  });

  app.get('/data/:id', auth.ensureAuthenticated, reqUtils.exist('id', TravelerData), function (req, res) {
    var data = req[req.params.id];
    if (data.inputType === 'file') {
      fs.exists(data.file.path, function (exists) {
        if (exists) {
          return res.sendFile(path.resolve(data.file.path));
        }
        return res.status(410).send('gone');
      });
    } else {
      res.status(200).json(data);
    }
  });

  app.get('/travelers/:id/share/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), function (req, res) {
    var traveler = req[req.params.id];
    return res.render('share', routesUtilities.getRenderObject(req, {
      type: 'Traveler',
      id: req.params.id,
      title: traveler.title,
      access: String(traveler.publicAccess)
    }));
  });

  app.put('/travelers/:id/share/public', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), reqUtils.filter('body', ['access']), function (req, res) {
    var traveler = req[req.params.id];
    // change the access
    var access = req.body.access;
    if (['-1', '0', '1'].indexOf(access) === -1) {
      return res.status(400).send('not valid value');
    }
    access = Number(access);
    if (traveler.publicAccess === access) {
      return res.status(204).send();
    }
    traveler.publicAccess = access;
    traveler.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(200).send('public access is set to ' + req.body.access);
    });
  });

  app.get('/travelers/:id/share/:list/json', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), function (req, res) {
    var traveler = req[req.params.id];
    if (req.params.list === 'users') {
      return res.status(200).json(traveler.sharedWith || []);
    }
    if (req.params.list === 'groups') {
      return res.status(200).json(traveler.sharedGroup || []);
    }
    return res.status(400).send('unknown share list.');
  });

  app.post('/travelers/:id/share/:list/', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), function (req, res) {
    var traveler = req[req.params.id];
    var share = -2;
    if (req.params.list === 'users') {
      if (req.body.name) {
        share = reqUtils.getSharedWith(traveler.sharedWith, req.body.name);
      } else {
        return res.status(400).send('user name is empty.');
      }
    }
    if (req.params.list === 'groups') {
      if (req.body.id) {
        share = reqUtils.getSharedGroup(traveler.sharedGroup, req.body.id);
      } else {
        return res.status(400).send('group id is empty.');
      }
    }

    if (share === -2) {
      return res.status(400).send('unknown share list.');
    }

    if (share >= 0) {
      return res.status(400).send(req.body.name || req.body.id + ' is already in the ' + req.params.list + ' list.');
    }

    if (share === -1) {
      // new user
      shareLib.addShare(req, res, traveler);
    }
  });

  app.put('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), function (req, res) {
    var traveler = req[req.params.id];
    var share;
    if (req.params.list === 'users') {
      share = traveler.sharedWith.id(req.params.shareid);
    }
    if (req.params.list === 'groups') {
      share = traveler.sharedGroup.id(req.params.shareid);
    }
    if (!share) {
      return res.status(400).send('cannot find ' + req.params.shareid + ' in the list.');
    }
    // change the access
    if (req.body.access && req.body.access === 'write') {
      share.access = 1;
    } else {
      share.access = 0;
    }
    traveler.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      // check consistency of user's traveler list
      var Target;
      if (req.params.list === 'users') {
        Target = User;
      }
      if (req.params.list === 'groups') {
        Target = Group;
      }
      Target.findByIdAndUpdate(req.params.shareid, {
        $addToSet: {
          travelers: traveler._id
        }
      }, function (updateErr, target) {
        if (updateErr) {
          console.error(updateErr);
        }
        if (!target) {
          console.error('The user/group ' + req.params.userid + ' is not in the db');
        }
      });
      return res.status(200).json(share);
    });
  });

  app.delete('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', Traveler), reqUtils.isOwnerMw('id'), reqUtils.archived('id', false), function (req, res) {
    var traveler = req[req.params.id];
    shareLib.removeShare(req, res, traveler);
  });

};
