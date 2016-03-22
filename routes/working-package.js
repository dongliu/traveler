/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

var auth = require('../lib/auth');
var authConfig = require('../config/config').auth;
var mongoose = require('mongoose');
var underscore = require('underscore');
var reqUtils = require('../lib/reqUtils');
var addShare = require('../lib/share').addShare;

require('../model/working-package.js');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var WorkingPackage = mongoose.model('WorkingPackage');
var Traveler = mongoose.model('Traveler');

module.exports = function (app) {

  app.get('/workingpackages/', auth.ensureAuthenticated, function (req, res) {
    res.render('working-packages');
  });

  app.get('/workingpackages/json', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.find({
      createdBy: req.session.userid,
      archived: {
        $ne: true
      },
      owner: {
        $exists: false
      }
    }).exec(function (err, docs) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, docs);
    });
  });

  app.get('/workingpackages/:id/config', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.findById(req.params.id).exec(function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (reqUtils.canWrite(req, doc)) {
        return res.render('working-package-config', {
          package: doc
        });
      }
      return res.send(403, 'You are not authorized to access this resource');
    });
  });

  app.post('/workingpackages/:id/tags/', auth.ensureAuthenticated, reqUtils.filterBody(['newtag']), function (req, res) {
    WorkingPackage.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.tags.addToSet(req.body.newtag);
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.send(204);
      });
    });
  });

  app.delete('/workingpackages/:id/tags/:number', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.tags.pull(req.params.number);
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.send(204);
      });
    });
  });

  app.put('/workingpackages/:id/config', auth.ensureAuthenticated, reqUtils.filterBody(['title', 'description']), function (req, res) {
    WorkingPackage.findById(req.params.id, function (err, doc) {
      var k;
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      for (k in req.body) {
        if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
          doc[k] = req.body[k];
        }
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.send(204);
      });
    });
  });


  app.get('/workingpackages/:id/share/', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.findById(req.params.id).exec(function (err, pack) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!pack) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, pack)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.render('share', {
        type: 'Working package',
        id: req.params.id,
        title: pack.title,
        access: String(pack.publicAccess)
      });
    });
  });

  app.put('/workingpackages/:id/share/public', auth.ensureAuthenticated, reqUtils.filterBody(['access']), function (req, res) {
    WorkingPackage.findById(req.params.id, function (err, pack) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!pack) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, pack)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      // change the access
      var access = req.body.access;
      if (['-1', '0', '1'].indexOf(access) === -1) {
        return res.send(400, 'not valid value');
      }
      access = Number(access);
      if (pack.publicAccess === access) {
        return res.send(204);
      }
      pack.publicAccess = access;
      pack.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.send(200, 'public access is set to ' + req.body.access);
      });
    });
  });

  app.get('/workingpackages/:id/share/:list/json', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.findById(req.params.id).exec(function (err, pack) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!pack) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, pack)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      if (req.params.list === 'users') {
        return res.json(200, pack.sharedWith || []);
      }
      if (req.params.list === 'groups') {
        return res.json(200, pack.sharedGroup || []);
      }
      return res.send(400, 'unknown share list.');
    });
  });

  app.post('/workingpackages/:id/share/:list/', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.findById(req.params.id, function (err, pack) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!pack) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, pack)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = -2;
      if (req.params.list === 'users') {
        if (req.body.name) {
          share = reqUtils.getSharedWith(pack.sharedWith, req.body.name);
        } else {
          return res.send(400, 'user name is empty.');
        }
      }
      if (req.params.list === 'groups') {
        if (req.body.id) {
          share = reqUtils.getSharedGroup(pack.sharedGroup, req.body.id);
        } else {
          return res.send(400, 'group id is empty.');
        }
      }

      if (share === -2) {
        return res.send(400, 'unknown share list.');
      }

      if (share >= 0) {
        return res.send(400, req.body.name || req.body.id + ' is already in the ' + req.params.list + ' list.');
      }

      if (share === -1) {
        // new user
        addShare(req, res, pack);
      }
    });
  });

  app.put('/workingpackages/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.findById(req.params.id, function (err, pack) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!pack) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, pack)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = pack.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = pack.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        // change the access
        if (req.body.access && req.body.access === 'write') {
          share.access = 1;
        } else {
          share.access = 0;
        }
        pack.save(function (saveErr) {
          if (saveErr) {
            console.error(saveErr);
            return res.send(500, saveErr.message);
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
              packages: pack._id
            }
          }, function (updateErr, target) {
            if (updateErr) {
              console.error(updateErr);
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

  app.delete('/workingpackages/:id/share/:list/:shareid', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.findById(req.params.id, function (err, pack) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!pack) {
        return res.send(410, 'gone');
      }
      if (!reqUtils.isOwner(req, pack)) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share;
      if (req.params.list === 'users') {
        share = pack.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = pack.sharedGroup.id(req.params.shareid);
      }
      if (share) {
        share.remove();
        pack.save(function (saveErr) {
          if (saveErr) {
            console.error(saveErr);
            return res.send(500, saveErr.message);
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
              packages: pack._id
            }
          }, function (updateErr, target) {
            if (updateErr) {
              console.error(updateErr);
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

  app.get('/workingpackages/new', auth.ensureAuthenticated, function (req, res) {
    res.render('new_package');
  });

  app.post('/workingpackages/', auth.ensureAuthenticated, function (req, res) {
    var workingPackage = {};
    if (req.body.works && underscore.isArray(req.body.works)) {
      workingPackage.works = req.body.works;
    } else {
      workingPackage.works = [];
    }

    workingPackage.title = req.body.title;
    if (req.body.description) {
      workingPackage.description = req.body.description;
    }
    workingPackage.createdBy = req.session.userid;
    workingPackage.createdOn = Date.now();
    (new WorkingPackage(workingPackage)).save(function (err, newPackage) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/workingpackages/' + newPackage.id + '/';

      res.set('Location', url);
      return res.send(201, 'You can access the new packace at <a href="' + url + '">' + url + '</a>');
    });
  });

  app.get('/transferredpackages/json', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.find({
      owner: req.session.userid,
      archived: {
        $ne: true
      }
    }).exec(function (err, packages) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.json(200, packages);
    });
  });

  app.get('/ownedpackages/json', auth.ensureAuthenticated, function (req, res) {
    var search = {
      archived: {
        $ne: true
      },
      $or: [{
        createdBy: req.session.userid,
        owner: {
          $exists: false
        }
      }, {
        owner: req.session.userid
      }]
    };

    WorkingPackage.find(search).lean().exec(function (err, packages) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, packages);
    });
  });

  app.get('/sharedpackages/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'packages').exec(function (err, me) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!me) {
        return res.send(400, 'cannot identify the current user');
      }
      WorkingPackage.find({
        _id: {
          $in: me.packages
        },
        archived: {
          $ne: true
        }
      }).exec(function (pErr, packages) {
        if (pErr) {
          console.error(pErr);
          return res.send(500, pErr.message);
        }
        return res.json(200, packages);
      });
    });
  });

  app.get('/groupsharedpackages/json', auth.ensureAuthenticated, function (req, res) {
    Group.find({
      _id: {
        $in: req.session.memberOf
      }
    }, 'packages').exec(function (err, groups) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var packageIds = [];
      var i;
      var j;
      // merge the packages arrays
      for (i = 0; i < groups.length; i += 1) {
        for (j = 0; j < groups[i].packages.length; j += 1) {
          if (packageIds.indexOf(groups[i].packages[j]) === -1) {
            packageIds.push(groups[i].packages[j]);
          }
        }
      }
      WorkingPackage.find({
        _id: {
          $in: packageIds
        }
      }).exec(function (pErr, packages) {
        if (pErr) {
          console.error(pErr);
          return res.send(500, pErr.message);
        }
        res.json(200, packages);
      });
    });
  });

  app.get('/archivedpackages/json', auth.ensureAuthenticated, function (req, res) {
    WorkingPackage.find({
      createdBy: req.session.userid,
      archived: true
    }).exec(function (err, packages) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, packages);
    });
  });

  app.get('/workingpackages/:id/', auth.ensureAuthenticated, function (req, res) {
    res.send('under development');
  });

  function addWork(p, req, res) {
    var tids = req.body.travelers;
    var pids = req.body.packages;
    var type;
    var model;
    if (tids) {
      if (tids.length === 0) {
        return res.send(204);
      }
      type = 'traveler';
      model = Traveler;
    } else {
      if (pids.length === 0) {
        return res.send(204);
      }
      type = 'package';
      model = WorkingPackage;
    }

    var works = p.works;
    var added = [];

    model.find({
      _id: {
        $in: tids
      }
    }).exec(function (err, items) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }

      if (items.length === 0) {
        return res.send(204);
      }

      items.forEach(function (item) {
        if (type === 'package' && item.id === p.id) {
          // do not add itself as a work
          return;
        }
        if (!works.id(item._id)) {
          works.push({
            _id: item._id,
            alias: item.title,
            refType: type,
            addedOn: Date.now(),
            addedBy: req.session.userid
          });
          added.push(item.id);
        }
      });

      if (added.length === 0) {
        return res.send(204);
      }

      p.save(function (saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.json(200, {
          items: added,
          type: type
        });
      });
    });
  }

  app.post('/workingpackages/:id/', auth.ensureAuthenticated, reqUtils.filterBody(['travelers', 'packages']), function (req, res) {
    WorkingPackage.findById(req.params.id).exec(function (err, p) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }

      if (!p) {
        return res.send(404, 'working package ' + req.params.id + ' is not found.');
      }
      addWork(p, req, res);
    });
  });

};
