/*jslint es5: true*/
var config = require('../config/config.js');

var routesUtilities = require('../utilities/routes.js');

var ad = config.ad;
var serviceConfig = config.service;
var ldapClient = require('../lib/ldap-client');

var fs = require('fs');
var auth = require('../lib/auth');
var authConfig = config.auth;
var mongoose = require('mongoose');
var util = require('util');
var path = require('path');
var pause = require('pause');
var underscore = require('underscore');
var cheer = require('cheerio');
// var sanitize = require('sanitize-caja'); // may need this later for new version of forms

var uploadsDir = '../' + config.uploadPath + '/';

var Form = mongoose.model('Form');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerNote = mongoose.model('TravelerNote');

var travelerV1API = 'https://liud-dev:8181/traveler/api.php';
var request = require('request');

function cloneTraveler(source, req, res) {
  var traveler = new Traveler({
    title: source.title,
    description: source.description,
    devices: [],
    status: 1,
    createdBy: source.createdBy,
    createdOn: Date.now(),
    clonedBy: req.session.userid,
    clonedFrom: source._id,
    sharedWith: source.sharedWith,
    sharedGroup: source.sharedGroup,
    referenceForm: source.referenceForm,
    forms: source.forms,
    data: [],
    comments: [],
    totalInput: source.totalInput,
    finishedInput: 0
  });
  traveler.save(function (err, doc) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    console.log('new traveler ' + doc.id + ' created');
    doc.sharedWith.forEach(function (e, i, a) {
      User.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (err, user) {
        if (err) {
          console.error(err);
        }
        if (!user) {
          console.error('The user ' + e._id + ' does not in the db');
        }
      });
    });

    doc.sharedGroup.forEach(function (e, i, a) {
      Group.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (err, user) {
        if (err) {
          console.error(err);
        }
        if (!user) {
          console.error('The group ' + e._id + ' does not in the db');
        }
      });
    });

    var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + doc.id + '/';
    res.set('Location', url);
    return res.json(201, {
      location: url
    });
  });
}

function getSharedWith(sharedWith, name) {
  var i;
  if (sharedWith.length === 0) {
    return -1;
  }
  for (i = 0; i < sharedWith.length; i += 1) {
    if (sharedWith[i].username === name) {
      return i;
    }
  }
  return -1;
}

function getSharedGroup(sharedGroup, id) {
  var i;
  if (sharedGroup.length === 0) {
    return -1;
  }
  for (i = 0; i < sharedGroup.length; i += 1) {
    if (sharedGroup[i]._id === id) {
      return i;
    }
  }
  return -1;
}

function addUserFromAD(req, res, traveler) {
  var name = req.param('name');
  var nameFilter = ad.nameFilter.replace('_name', name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    if (err) {
      console.error(err.name + ' : ' + err.message);
      return res.json(500, err);
    }

    if (result.length === 0) {
      return res.send(404, name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, name + ' is not unique!');
    }

    var id = result[0].sAMAccountName.toLowerCase();
    var access = 0;
    if (req.param('access') && req.param('access') === 'write') {
      access = 1;
    }
    traveler.sharedWith.addToSet({
      _id: id,
      username: name,
      access: access
    });
    traveler.save(function (err) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var user = new User({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        office: result[0].physicalDeliveryOfficeName,
        phone: result[0].telephoneNumber,
        mobile: result[0].mobile,
        travelers: [traveler._id]
      });
      user.save(function (err) {
        if (err) {
          // console.dir(user);
          console.dir(err);
          console.error(err);
        }
      });
      return res.send(201, 'The user named ' + name + ' was added to the share list.');
    });
  });
}

function addGroupFromAD(req, res, traveler) {
  var id = req.body.id.toLowerCase();
  var filter = ad.groupSearchFilter.replace('_id', id);
  var opts = {
    filter: filter,
    attributes: ad.groupAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.groupSearchBase, opts, false, function (err, result) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }

    if (result.length === 0) {
      return res.send(400, id + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, id + ' is not unique!');
    }

    var name = result[0].displayName;
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    traveler.sharedGroup.addToSet({
      _id: id,
      groupname: name,
      access: access
    });
    traveler.save(function (err) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var group = new Group({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        travelers: [traveler._id]
      });
      group.save(function (err) {
        if (err) {
          console.error(err);
        }
      });
      return res.send(201, 'The group ' + id + ' was added to the share list.');
    });
  });
}

function canWrite(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return true;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid) && doc.sharedWith.id(req.session.userid).access === 1) {
    return true;
  }
  var i;
  if (doc.sharedGroup) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i]) && doc.sharedGroup.id(req.session.memberOf[i]).access === 1) {
        return true;
      }
    }
  }
  return false;
}

function canWriteActive(req,doc){
  if (canWrite(req,doc)){
    return true;
  }else if(routesUtilities.checkUserRole(req, 'write_active_travelers')){
    return true;
  }


  return false;
}

function canRead(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return true;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid)) {
    return true;
  }
  var i;
  if (doc.sharedGroup) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i])) {
        return true;
      }
    }
  }
  return false;
}

/*****
access := -1 // no access
        | 0  // read
        | 1  // write
*****/

function getAccess(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return 1;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid)) {
    return doc.sharedWith.id(req.session.userid).access;
  }
  var i;
  if (doc.sharedGroup) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i]) && doc.sharedGroup.id(req.session.memberOf[i]).access === 1) {
        return 1;
      }
    }
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i])) {
        return 0;
      }
    }
  }
  return -1;
}

// var gri, ha, generateShort;
/**
 * Returns an unsigned x-bit random integer.
 * @param {int} x A positive integer ranging from 0 to 53, inclusive.
 * @returns {int} An unsigned x-bit random integer (0 <= f(x) < 2^x).
 */
function gri(x) { // _getRandomInt
  if (x < 0) {
    return NaN;
  }
  if (x <= 30) {
    return (0 | Math.random() * (1 << x));
  }
  if (x <= 53) {
    return (0 | Math.random() * (1 << 30)) + (0 | Math.random() * (1 << x - 30)) * (1 << 30);
  }
  return NaN;
}

/**
 * Converts an integer to a zero-filled hexadecimal string.
 * @param {int} num
 * @param {int} length
 * @returns {string}
 */
function ha(num, length) { // _hexAligner
  var str = num.toString(16),
    i,
    z = "0";
  for (i = length - str.length; i > 0; i >>>= 1, z += z) {
    if (i & 1) {
      str = z + str;
    }
  }
  return str;
}

/*a short uid*/

function generateShort() {
  var rand = gri,
    hex = ha;
  return hex(rand(32), 8);
}

function addUser(req, res, traveler) {
  var name = req.body.name;
  // check local db first then try ad
  User.findOne({
    name: name
  }, function (err, user) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    if (user) {
      var access = 0;
      if (req.body.access && req.body.access === 'write') {
        access = 1;
      }
      traveler.sharedWith.addToSet({
        _id: user._id,
        username: name,
        access: access
      });
      traveler.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(201, 'The user named ' + name + ' was added to the share list.');
      });
      user.update({
        $addToSet: {
          travelers: traveler._id
        }
      }, function (err) {
        if (err) {
          console.error(err);
        }
      });
    } else {
      addUserFromAD(req, res, traveler);
    }
  });
}

function addGroup(req, res, traveler) {
  var id = req.body.id.toLowerCase();
  // check local db first then try ad
  Group.findOne({
    _id: id
  }, function (err, group) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    if (group) {
      var access = 0;
      if (req.body.access && req.body.access === 'write') {
        access = 1;
      }
      traveler.sharedGroup.addToSet({
        _id: id,
        groupname: group.name,
        access: access
      });
      traveler.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(201, 'The group ' + id + ' was added to the share list.');
      });
      group.update({
        $addToSet: {
          travelers: traveler._id
        }
      }, function (err) {
        if (err) {
          console.error(err);
        }
      });
    } else {
      addGroupFromAD(req, res, traveler);
    }
  });
}

function addShare(req, res, traveler) {

  if (req.params.list === 'users') {
    addUser(req, res, traveler);
  }

  if (req.params.list === 'groups') {
    addGroup(req, res, traveler);
  }

}

module.exports = function (app) {

  app.get('/travelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      createdBy: req.session.userid,
      archived: {
        $ne: true
      }
    }, 'title description status devices sharedWith sharedGroup clonedBy createdOn deadline updatedOn updatedBy finishedInput totalInput').lean().exec(function (err, docs) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, docs);
    });
  });

  app.get('/sharedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'travelers').lean().exec(function (err, me) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!me) {
        return res.send(400, 'cannot identify the current user');
      }
      Traveler.find({
        _id: {
          $in: me.travelers
        },
        archived: {
          $ne: true
        }
      }, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith sharedGroup finishedInput totalInput').lean().exec(function (err, travelers) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.json(200, travelers);
      });
    });
  });

  app.get('/groupsharedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Group.find({
      _id: {
        $in: req.session.memberOf
      }
    }, 'travelers').lean().exec(function (err, groups) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var travelerIds = [];
      var i, j;
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
      }, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith sharedGroup finishedInput totalInput').lean().exec(function (err, travelers) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        res.json(200, travelers);
      });
    });
  });

  app.get('/currenttravelers/json', auth.ensureAuthenticated, function (req, res) {
    // var device = req.query.device;
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
        return res.send(500, err.message);
      }
      return res.json(200, travelers);
    });
  });

  app.get('/currenttravelersinv1/json', auth.ensureAuthenticated, function (req, res) {
    var fullurl = travelerV1API + '?resource=travelers';
    if (req.query.hasOwnProperty('device')) {
      fullurl = fullurl + '&device=' + req.query.device;
    }
    request({
      strictSSL: false,
      url: fullurl
    }).pipe(res);
  });

  app.get('/currenttravelers/', auth.ensureAuthenticated, function (req, res) {
    var extraAttributes = {
      device: req.query.device || null,
    };
    if(serviceConfig.legacy_traveler){
      extraAttributes['legacyTraveler'] = serviceConfig.legacy_traveler;
    }
    return res.render('currenttravelers', routesUtilities.getRenderObject(req, extraAttributes));
  });

  app.get('/archivedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      createdBy: req.session.userid,
      archived: true
    }, 'title status devices createdBy createdOn deadline updatedBy updatedOn sharedWith sharedGroup finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, travelers);
    });
  });

  app.post('/travelers/', auth.ensureAuthenticated, routesUtilities.filterBody(['form', 'source']), function (req, res) {
    if (req.body.form) {
      Form.findById(req.body.form, function (err, form) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        if (form) {
          if (form.createdBy === req.session.userid) {
            routesUtilities.traveler.createTraveler(form, form.title, req.session.userid, [], function (err, doc) {
              if (err) {
                console.error(err);
                return res.send(500, err.message);
              }
              console.log('new traveler ' + doc.id + ' created');
              var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + doc.id + '/';
              res.set('Location', url);
              return res.json(201, {
                location: (req.proxied ? req.proxied_prefix : '') + '/travelers/' + doc.id + '/'
              });
            });
          } else {
            return res.send(400, 'You cannot create a traveler based on a form that you do not own.');
          }
        } else {
          return res.send(400, 'cannot find the form ' + req.body.form);
        }
      });
    }
    if (req.body.source) {
      Traveler.findById(req.body.source, function (err, traveler) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        if (traveler) {
          if (traveler.status === 0) {
            return res.send(400, 'You cannot clone an initialized traveler.');
          }
          if (canWrite(req, traveler)) {
            cloneTraveler(traveler, req, res);
          } else {
            return res.send(400, 'You cannot clone a traveler that you cannot write.');
          }
        } else {
          return res.send(400, 'cannot find the traveler ' + req.body.source);
        }
      });
    }
  });

  app.get('/travelers/:id/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (canWriteActive(req, doc)) {
        routesUtilities.getDeviceValue(doc.devices[0]).then(function (value) {
          doc.devices[0] = value;
          return res.render('traveler', routesUtilities.getRenderObject(req, {
            traveler: doc
          }));
        });
      } else {
        return res.redirect((req.proxied ? authConfig.proxied_service : authConfig.service) + '/travelers/' + req.params.id + '/view');
      }
    });
  });

  app.get('/travelers/:id/view', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      routesUtilities.getDeviceValue(doc.devices[0]).then(function(value){
        doc.devices[0] = value;
        return res.render('travelerviewer', routesUtilities.getRenderObject(req, {
          traveler: doc
        }));
      });
    });
  });

  app.get('/travelers/:id/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      // if (!canRead(req, doc)) {
      //   return res.send(403, 'You are not authorized to access this resource');
      // }
      return res.json(200, doc);
    });
  });

  app.put('/travelers/:id/archived', auth.ensureAuthenticated, routesUtilities.filterBody(['archived']), function (req, res) {
    Traveler.findById(req.params.id, 'createdBy archived').exec(function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (doc.createdBy !== req.session.userid) {
        return res.send(403, 'You are not authorized to access this resource');
      }

      if (doc.archived === req.body.archived) {
        return res.send(204);
      }

      doc.archived = req.body.archived;

      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });

    });
  });

  app.get('/travelers/:id/config', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, 'title description deadline status devices sharedWith sharedGroup createdBy createdOn updatedOn updatedBy').exec(function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (canWrite(req, doc)) {
        routesUtilities.getDeviceValue(doc.devices[0]).then(function(value){
          doc.devices[0] = value;
          return res.render('config', routesUtilities.getRenderObject(req, {
            traveler: doc,
            devicesRemovable: routesUtilities.deviceRemovalAllowed()
          }));
        });
      } else {
        return res.send(403, 'You are not authorized to access this resource');
      }

    });
  });

  app.put('/travelers/:id/config', auth.ensureAuthenticated, routesUtilities.filterBody(['title', 'description', 'deadline']), function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      var k;
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      for (k in req.body) {
        if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
          doc[k] = req.body[k];
        }
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.put('/travelers/:id/status', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (req.body.status === 1.5) {
        if (!canWriteActive(req, doc)) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      } else {
        if (doc.createdBy !== req.session.userid) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      }

      if (req.body.status === 1) {
        if ([0, 1.5, 3].indexOf(doc.status) !== -1) {
          doc.status = 1;
        } else {
          return res.send(400, 'cannot start to work from the current status');
        }
      }

      if (req.body.status === 1.5) {
        if ([1].indexOf(doc.status) !== -1) {
          doc.status = 1.5;
        } else {
          return res.send(400, 'cannot complete from the current status');
        }
      }

      if (req.body.status === 2) {
        if ([1, 1.5].indexOf(doc.status) !== -1) {
          doc.status = 2;
        } else {
          return res.send(400, 'cannot complete from the current status');
        }
      }

      if (req.body.status === 3) {
        if ([1].indexOf(doc.status) !== -1) {
          doc.status = 3;
        } else {
          return res.send(400, 'cannot freeze from the current status');
        }
      }

      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.post('/travelers/:id/devices/', auth.ensureAuthenticated, routesUtilities.filterBody(['newdevice']), function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.devices.addToSet(req.body.newdevice);
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.delete('/travelers/:id/devices/:number', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.devices.pull(req.params.number);
      doc.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.get('/travelers/:id/data/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      // if (!canRead(req, doc)) {
      //   return res.send(403, 'You are not authorized to access this resource');
      // }
      TravelerData.find({
        _id: {
          $in: doc.data
        }
      }, 'name value inputType inputBy inputOn').lean().exec(function (err, docs) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.json(200, docs);
      });
    });
  });

  app.post('/travelers/:id/data/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWriteActive(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }
      var data = new TravelerData({
        traveler: doc._id,
        name: req.body.name,
        value: req.body.value,
        inputType: req.body.type,
        inputBy: req.session.userid,
        inputOn: Date.now()
      });
      data.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        doc.data.push(data._id);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          return res.send(204);
        });
      });
    });
  });

  app.get('/travelers/:id/notes/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      // if (!canRead(req, doc)) {
      //   return res.send(403, 'You are not authorized to access this resource');
      // }
      TravelerNote.find({
        _id: {
          $in: doc.notes
        }
      }, 'name value inputBy inputOn').lean().exec(function (err, docs) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.json(200, docs);
      });
    });
  });

  app.post('/travelers/:id/notes/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWriteActive(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      // allow add note for all status
      // if (doc.status !== 1) {
      //   return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      // }
      var note = new TravelerNote({
        traveler: doc._id,
        name: req.body.name,
        value: req.body.value,
        inputBy: req.session.userid,
        inputOn: Date.now()
      });
      note.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        doc.notes.push(note._id);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          return res.send(204);
        });
      });
    });
  });

  app.put('/travelers/:id/finishedinput', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWriteActive(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }

      if (!req.body.hasOwnProperty('finishedInput')) {
        return res.send(400, 'need finished input number');
      }

      doc.update({
        finishedInput: req.body.finishedInput
      }, function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        return res.send(204);
      });
    });
  });

  app.post('/travelers/:id/uploads/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }

      // console.info(req.files);

      if (underscore.isEmpty(req.files)) {
        return res.send(400, 'Expecte One uploaded file');
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

      // console.dir(data);
      data.save(function (err) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        doc.data.push(data._id);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/data/' + data._id;
          res.set('Location', url);
          return res.json(201, {
            location: url
          });
        });
      });
    });
  });

  app.get('/data/:id', auth.ensureAuthenticated, function (req, res) {
    TravelerData.findById(req.params.id).lean().exec(function (err, data) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!data) {
        return res.send(410, 'gone');
      }
      if (data.inputType === 'file') {
        fs.exists(data.file.path, function (exists) {
          if (exists) {
            return res.sendfile(data.file.path);
          }
          return res.send(410, 'gone');
        });
      } else {
        res.json(200, data);
      }
    });
  });

  app.get('/travelers/:id/share/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id).lean().exec(function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.render('share', routesUtilities.getRenderObject(req, {
        type: 'Traveler',
        id: req.params.id,
        title: traveler.title
      }));
    });
  });

  app.get('/travelers/:id/share/:list/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id).lean().exec(function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      if (req.params.list === 'users') {
        return res.json(200, traveler.sharedWith || []);
      }
      if (req.params.list === 'groups') {
        return res.json(200, traveler.sharedGroup || []);
      }
      return res.send(400, 'unknown share list.');
    });
  });

  app.post('/travelers/:id/share/:list/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = -2;
      if (req.params.list === 'users') {
        share = getSharedWith(traveler.sharedWith, req.body.name);
      }
      if (req.params.list === 'groups') {
        share = getSharedGroup(traveler.sharedGroup, req.body.id);
      }

      if (share === -2) {
        return res.send(400, 'unknown share list.');
      }

      if (share >= 0) {
        return res.send(400, req.body.name || req.body.id + ' is already in the ' + req.params.list + ' list.');
      }

      if (share === -1) {
        // new user
        addShare(req, res, traveler);
      }
    });
  });


  app.put('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = traveler.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = traveler.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        // change the access
        if (req.body.access && req.body.access === 'write') {
          share.access = 1;
        } else {
          share.access = 0;
        }
        traveler.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
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
          }, function (err, target) {
            if (err) {
              console.error(err);
            }
            if (!target) {
              console.error('The user/group ' + req.params.userid + ' is not in the db');
            }
          });
          return res.send(204);
        });
      } else {
        // the user should in the list
        return res.send(400, 'cannot find ' + req.params.shareid + ' in the list.');
      }
    });
  });

  app.delete('/travelers/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = traveler.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = traveler.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        share.remove();
        traveler.save(function (err) {
          if (err) {
            console.error(err);
            return res.send(500, err.message);
          }
          // keep the consistency of user's traveler list
          var Target;
          if (req.params.list === 'users') {
            Target = User;
          }
          if (req.params.list === 'groups') {
            Target = Group;
          }
          Target.findByIdAndUpdate(req.params.shareid, {
            $pull: {
              travelers: traveler._id
            }
          }, function (err, target) {
            if (err) {
              console.error(err);
            }
            if (!target) {
              console.error('The user/group ' + req.params.shareid + ' is not in the db');
            }
          });
          return res.send(204);
        });
      } else {
        return res.send(400, 'cannot find ' + req.params.shareid + ' in list.');
      }
    });
  });

};
