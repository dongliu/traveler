/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

var auth = require('../lib/auth');
var authConfig = require('../config/config').auth;
var mongoose = require('mongoose');
var underscore = require('underscore');
var reqUtils = require('../lib/req-utils');
var shareLib = require('../lib/share');

require('../model/work-package.js');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var WorkPackage = mongoose.model('WorkPackage');
var Traveler = mongoose.model('Traveler');

module.exports = function (app) {

  app.get('/workpackages/', auth.ensureAuthenticated, function (req, res) {
    res.render('work-packages');
  });

  app.get('/workpackages/json', auth.ensureAuthenticated, function (req, res) {
    WorkPackage.find({
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

  app.get('/workpackages/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canWriteMw('id'), function (req, res) {
    return res.render('work-package-config', {
      package: req[req.params.id]
    });
  });

  app.post('/workpackages/:id/tags/', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['newtag']), reqUtils.sanitize('body', ['newtag']), function (req, res) {
    var doc = req[req.params.id];
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

  app.delete('/workpackages/:id/tags/:tag', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canWriteMw('id'), function (req, res) {
    var doc = req[req.params.id];
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    doc.tags.pull(req.params.tag);
    doc.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(204);
    });
  });

  app.put('/workpackages/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['title', 'description']), reqUtils.sanitize('body', ['title', 'description']), function (req, res) {
    var k;
    var doc = req[req.params.id];
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


  app.get('/workpackages/:id/share/', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), function (req, res) {
    var pack = req[req.params.id];
    return res.render('share', {
      type: 'Work package',
      id: req.params.id,
      title: pack.title,
      access: String(pack.publicAccess)
    });
  });

  app.put('/workpackages/:id/share/public', auth.ensureAuthenticated, reqUtils.filter('body', ['access']), reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), function (req, res) {
    var pack = req[req.params.id];
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

  app.get('/workpackages/:id/share/:list/json', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canReadMw('id'), function (req, res) {
    var pack = req[req.params.id];
    if (req.params.list === 'users') {
      return res.json(200, pack.sharedWith || []);
    }
    if (req.params.list === 'groups') {
      return res.json(200, pack.sharedGroup || []);
    }
    return res.send(400, 'unknown share list.');
  });

  app.post('/workpackages/:id/share/:list/', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), function (req, res) {
    var pack = req[req.params.id];
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
      // new user in the list
      shareLib.addShare(req, res, pack);
    }
  });

  app.put('/workpackages/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), function (req, res) {
    var pack = req[req.params.id];
    var share;
    if (req.params.list === 'users') {
      share = pack.sharedWith.id(req.params.shareid);
    }
    if (req.params.list === 'groups') {
      share = pack.sharedGroup.id(req.params.shareid);
    }

    if (!share) {
      // the user should in the list
      return res.send(404, 'cannot find ' + req.params.shareid + ' in the list.');
    }

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
      return res.json(200, share);
    });
  });

  app.delete('/workpackages/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), function (req, res) {
    var pack = req[req.params.id];
    shareLib.removeShare(req, res, pack);
  });

  app.get('/workpackages/new', auth.ensureAuthenticated, function (req, res) {
    res.render('new_package');
  });

  app.post('/workpackages/', auth.ensureAuthenticated, reqUtils.filter('body', ['title', 'description']), reqUtils.hasAll('body', ['title']), reqUtils.sanitize('body', ['title', 'description']), function (req, res) {
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
    (new WorkPackage(workingPackage)).save(function (err, newPackage) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/workpackages/' + newPackage.id + '/';

      res.set('Location', url);
      return res.send(201, 'You can access the new package at <a href="' + url + '">' + url + '</a>');
    });
  });

  app.get('/transferredpackages/json', auth.ensureAuthenticated, function (req, res) {
    WorkPackage.find({
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

    WorkPackage.find(search).lean().exec(function (err, packages) {
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
      WorkPackage.find({
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
      WorkPackage.find({
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
    WorkPackage.find({
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

  app.put('/workpackages/:id/archived', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['archived']), function (req, res) {
    var doc = req[req.params.id];
    if (doc.archived === req.body.archived) {
      return res.send(204);
    }

    doc.archived = req.body.archived;

    if (doc.archived) {
      doc.archivedOn = Date.now();
    }

    doc.save(function (saveErr, newDoc) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(200, 'Work package ' + req.params.id + ' archived state set to ' + newDoc.archived);
    });

  });

  app.put('/workpackages/:id/owner', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['name']), function (req, res) {
    var doc = req[req.params.id];
    shareLib.changeOwner(req, res, doc);
  });

  app.get('/workpackages/:id/', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canReadMw('id'), function (req, res) {
    res.render('work-package', {
      package: req[req.params.id]
    });
  });

  app.get('/workpackages/:id/json', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canReadMw('id'), reqUtils.exist('id', WorkPackage), function (req, res) {
    res.json(200, req[req.params.id]);
  });

  app.put('/workpackages/:id/status', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['status']), reqUtils.hasAll('body', ['status']), function (req, res) {
    var p = req[req.params.id];
    var s = req.body.status;

    if ([1, 2].indexOf(s) === -1) {
      return res.send(400, 'invalid status');
    }

    if (p.status === s) {
      return res.send(204);
    }

    if (s === 1) {
      if ([0, 2].indexOf(p.status) === -1) {
        return res.send(400, 'invalid status change');
      } else {
        p.status = s;
      }
    } else if (s === 2) {
      if ([1].indexOf(p.status) === -1) {
        return res.send(400, 'invalid status change');
      } else {
        p.status = s;
      }
    } else {
      return res.send(400, 'invalid status');
    }

    p.save(function (err) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.send(200, 'status updated to ' + s);
    });

  });

  function sendMerged(t, p, res, merged, workingPackage) {
    if (t && p) {
      if (workingPackage.isModified()) {
        workingPackage.updateProgress();
      }
      res.json(200, merged);
    }
  }

  app.get('/workpackages/:id/works/json', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canReadMw('id'), function (req, res) {
    var workingPackage = req[req.params.id];
    var works = workingPackage.works;

    var tids = [];
    var pids = [];

    works.forEach(function (w) {
      if (w.refType === 'traveler') {
        tids.push(w._id);
      } else {
        pids.push(w._id);
      }
    });

    if (tids.length + pids.length === 0) {
      return res.json(200, []);
    }

    var merged = [];

    var tFinished = false;
    var pFinished = false;

    if (tids.length === 0) {
      tFinished = true;
    }

    if (pids.length === 0) {
      pFinished = true;
    }

    if (tids.length !== 0) {
      Traveler.find({
        _id: {
          $in: tids
        }
      }, 'devices locations manPower status createdBy owner sharedWith finishedInput totalInput').lean().exec(function (err, travelers) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }
        travelers.forEach(function (t) {
          workingPackage.updateWorkProgress(t);

          // works has its own toJSON, therefore need to merge only the plain
          // object
          underscore.extend(t, works.id(t._id).toJSON());
          merged.push(t);
        });
        tFinished = true;
        // check if ready to respond
        sendMerged(tFinished, pFinished, res, merged, workingPackage);
      });
    }

    if (pids.length !== 0) {
      WorkPackage.find({
        _id: {
          $in: pids
        }
      }, 'tags status createdBy owner finishedValue inProgressValue totalValue').lean().exec(function (err, workingPackages) {
        workingPackages.forEach(function (p) {
          workingPackage.updateWorkProgress(p);
          underscore.extend(p, works.id(p._id).toJSON());
          merged.push(p);
        });
        pFinished = true;
        sendMerged(tFinished, pFinished, res, merged, workingPackage);
      });
    }
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
      model = WorkPackage;
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
        var newWork;
        if (!works.id(item._id)) {
          newWork = {
            _id: item._id,
            alias: item.title,
            refType: type,
            addedOn: Date.now(),
            addedBy: req.session.userid,
            status: item.status || 0,
            value: item.value || 10
          };
          if (item.status === 2) {
            newWork.finished = 1;
            newWork.inProgress = 0;
          } else if (type === 'traveler') {
            newWork.finished = 0;
            if (item.totalInput === 0) {
              newWork.inProgress = 1;
            } else {
              newWork.inProgress = item.finishedInput / item.totalInput;
            }
          } else if (item.totalValue === 0) {
            newWork.finished = 0;
            newWork.inProgress = 1;
          } else {
            newWork.finished = item.finishedValue / item.totalValue;
            newWork.inProgress = item.inProgressValue / item.totalValue;
          }
          works.push(newWork);
          added.push(item.id);
        }
      });

      if (added.length === 0) {
        return res.send(204);
      }

      p.updatedOn = Date.now();
      p.updatedBy = req.session.userid;

      // update the totalValue, finishedValue, and finishedValue
      p.updateProgress(function (saveErr, newPackage) {
        if (saveErr) {
          console.error(saveErr);
          return res.send(500, saveErr.message);
        }
        return res.json(200, newPackage);
      });
    });
  }

  app.post('/workpackages/:id/', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['travelers', 'packages']), function (req, res) {
    addWork(req[req.params.id], req, res);
  });


  app.delete('/workpackages/:id/works/:wid', auth.ensureAuthenticated, reqUtils.exist('id', WorkPackage), reqUtils.canWriteMw('id'), function (req, res) {
    var p = req[req.params.id];
    var work = p.works.id(req.params.wid);

    if (!work) {
      res.send(404, 'Work ' + req.params.wid + ' not found in the package.');
    }

    work.remove();
    p.updatedBy = req.session.userid;
    p.updatedOn = Date.now();

    p.save(function (saveErr, newPackage) {
      if (saveErr) {
        console.log(saveErr);
        res.send(500, saveErr.message);
      }
      newPackage.updateProgress();
      res.send(204);
    });
  });

};
