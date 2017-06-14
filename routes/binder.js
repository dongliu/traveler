/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

var auth = require('../lib/auth');
var authConfig = require('../config/config').auth;
var mongoose = require('mongoose');
var underscore = require('underscore');
var reqUtils = require('../lib/req-utils');
var shareLib = require('../lib/share');

require('../model/binder.js');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var Binder = mongoose.model('Binder');
var Traveler = mongoose.model('Traveler');

module.exports = function (app) {

  app.get('/binders/', auth.ensureAuthenticated, function (req, res) {
    res.render('binders');
  });

  app.get('/binders/json', auth.ensureAuthenticated, function (req, res) {
    Binder.find({
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

  app.get('/binders/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canWriteMw('id'), function (req, res) {
    return res.render('binder-config', {
      binder: req[req.params.id]
    });
  });

  app.post('/binders/:id/tags/', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canWriteMw('id'), reqUtils.filter('body', ['newtag']), reqUtils.sanitize('body', ['newtag']), function (req, res) {
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

  app.delete('/binders/:id/tags/:tag', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canWriteMw('id'), function (req, res) {
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

  app.put('/binders/:id/config', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['title', 'description']), reqUtils.sanitize('body', ['title', 'description']), function (req, res) {
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


  app.get('/binders/:id/share/', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), function (req, res) {
    var binder = req[req.params.id];
    return res.render('share', {
      type: 'Binder',
      id: req.params.id,
      title: binder.title,
      access: String(binder.publicAccess)
    });
  });

  app.put('/binders/:id/share/public', auth.ensureAuthenticated, reqUtils.filter('body', ['access']), reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), function (req, res) {
    var binder = req[req.params.id];
    var access = req.body.access;
    if (['-1', '0', '1'].indexOf(access) === -1) {
      return res.send(400, 'not valid value');
    }
    access = Number(access);
    if (binder.publicAccess === access) {
      return res.send(204);
    }
    binder.publicAccess = access;
    binder.save(function (saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.send(500, saveErr.message);
      }
      return res.send(200, 'public access is set to ' + req.body.access);
    });
  });

  app.get('/binders/:id/share/:list/json', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canReadMw('id'), function (req, res) {
    var binder = req[req.params.id];
    if (req.params.list === 'users') {
      return res.json(200, binder.sharedWith || []);
    }
    if (req.params.list === 'groups') {
      return res.json(200, binder.sharedGroup || []);
    }
    return res.send(400, 'unknown share list.');
  });

  app.post('/binders/:id/share/:list/', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), function (req, res) {
    var binder = req[req.params.id];
    var share = -2;
    if (req.params.list === 'users') {
      if (req.body.name) {
        share = reqUtils.getSharedWith(binder.sharedWith, req.body.name);
      } else {
        return res.send(400, 'user name is empty.');
      }
    }
    if (req.params.list === 'groups') {
      if (req.body.id) {
        share = reqUtils.getSharedGroup(binder.sharedGroup, req.body.id);
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
      shareLib.addShare(req, res, binder);
    }
  });

  app.put('/binders/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), function (req, res) {
    var binder = req[req.params.id];
    var share;
    if (req.params.list === 'users') {
      share = binder.sharedWith.id(req.params.shareid);
    }
    if (req.params.list === 'groups') {
      share = binder.sharedGroup.id(req.params.shareid);
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
    binder.save(function (saveErr) {
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
          binders: binder._id
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

  app.delete('/binders/:id/share/:list/:shareid', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), function (req, res) {
    var binder = req[req.params.id];
    shareLib.removeShare(req, res, binder);
  });

  app.get('/binders/new', auth.ensureAuthenticated, function (req, res) {
    res.render('binder-new');
  });

  app.post('/binders/', auth.ensureAuthenticated, reqUtils.filter('body', ['title', 'description']), reqUtils.hasAll('body', ['title']), reqUtils.sanitize('body', ['title', 'description']), function (req, res) {
    var binder = {};
    if (req.body.works && underscore.isArray(req.body.works)) {
      binder.works = req.body.works;
    } else {
      binder.works = [];
    }

    binder.title = req.body.title;
    if (req.body.description) {
      binder.description = req.body.description;
    }
    binder.createdBy = req.session.userid;
    binder.createdOn = Date.now();
    (new Binder(binder)).save(function (err, newPackage) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var url = (req.proxied ? authConfig.proxied_service : authConfig.service) + '/binders/' + newPackage.id + '/';

      res.set('Location', url);
      return res.send(201, 'You can access the new binder at <a href="' + url + '">' + url + '</a>');
    });
  });

  app.get('/transferredbinders/json', auth.ensureAuthenticated, function (req, res) {
    Binder.find({
      owner: req.session.userid,
      archived: {
        $ne: true
      }
    }).exec(function (err, binders) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.json(200, binders);
    });
  });

  app.get('/ownedbinders/json', auth.ensureAuthenticated, function (req, res) {
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

    Binder.find(search).lean().exec(function (err, binders) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, binders);
    });
  });

  app.get('/sharedbinders/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'binders').exec(function (err, me) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!me) {
        return res.send(400, 'cannot identify the current user');
      }
      Binder.find({
        _id: {
          $in: me.binders
        },
        archived: {
          $ne: true
        }
      }).exec(function (pErr, binders) {
        if (pErr) {
          console.error(pErr);
          return res.send(500, pErr.message);
        }
        return res.json(200, binders);
      });
    });
  });

  app.get('/groupsharedbinders/json', auth.ensureAuthenticated, function (req, res) {
    Group.find({
      _id: {
        $in: req.session.memberOf
      }
    }, 'binders').exec(function (err, groups) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      var binderIds = [];
      var i;
      var j;
      // merge the binders arrays
      for (i = 0; i < groups.length; i += 1) {
        for (j = 0; j < groups[i].binders.length; j += 1) {
          if (binderIds.indexOf(groups[i].binders[j]) === -1) {
            binderIds.push(groups[i].binders[j]);
          }
        }
      }
      Binder.find({
        _id: {
          $in: binderIds
        }
      }).exec(function (pErr, binders) {
        if (pErr) {
          console.error(pErr);
          return res.send(500, pErr.message);
        }
        res.json(200, binders);
      });
    });
  });

  app.get('/archivedbinders/json', auth.ensureAuthenticated, function (req, res) {
    Binder.find({
      createdBy: req.session.userid,
      archived: true
    }).exec(function (err, binders) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, binders);
    });
  });

  app.put('/binders/:id/archived', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['archived']), function (req, res) {
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
      return res.send(200, 'Binder ' + req.params.id + ' archived state set to ' + newDoc.archived);
    });

  });

  app.put('/binders/:id/owner', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['name']), function (req, res) {
    var doc = req[req.params.id];
    shareLib.changeOwner(req, res, doc);
  });

  app.get('/binders/:id/', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canReadMw('id'), function (req, res) {
    res.render('binder', {
      binder: req[req.params.id]
    });
  });

  app.get('/binders/:id/json', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canReadMw('id'), reqUtils.exist('id', Binder), function (req, res) {
    res.json(200, req[req.params.id]);
  });

  app.put('/binders/:id/status', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.isOwnerMw('id'), reqUtils.filter('body', ['status']), reqUtils.hasAll('body', ['status']), function (req, res) {
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
    }

    if (s === 2) {
      if ([1].indexOf(p.status) === -1) {
        return res.send(400, 'invalid status change');
      } else {
        p.status = s;
      }
    }

    p.save(function (err) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.send(200, 'status updated to ' + s);
    });

  });

  function sendMerged(t, p, res, merged, binder) {
    if (t && p) {
      if (binder.isModified()) {
        binder.updateProgress();
      }
      res.json(200, merged);
    }
  }

  app.get('/binders/:id/works/json', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canReadMw('id'), function (req, res) {
    var binder = req[req.params.id];
    var works = binder.works;

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
          binder.updateWorkProgress(t);

          // works has its own toJSON, therefore need to merge only the plain
          // object
          underscore.extend(t, works.id(t._id).toJSON());
          merged.push(t);
        });
        tFinished = true;
        // check if ready to respond
        sendMerged(tFinished, pFinished, res, merged, binder);
      });
    }

    if (pids.length !== 0) {
      Binder.find({
        _id: {
          $in: pids
        }
      }, 'tags status createdBy owner finishedValue inProgressValue totalValue').lean().exec(function (err, binders) {
        binders.forEach(function (p) {
          binder.updateWorkProgress(p);
          underscore.extend(p, works.id(p._id).toJSON());
          merged.push(p);
        });
        pFinished = true;
        sendMerged(tFinished, pFinished, res, merged, binder);
      });
    }
  });

  function addWork(p, req, res) {
    var tids = req.body.travelers;
    var pids = req.body.binders;
    var ids;
    var type;
    var model;
    if (tids) {
      if (tids.length === 0) {
        return res.send(204);
      }
      type = 'traveler';
      model = Traveler;
      ids = tids;
    } else {
      if (pids.length === 0) {
        return res.send(204);
      }
      type = 'binder';
      model = Binder;
      ids = pids;
    }

    var works = p.works;
    var added = [];

    model.find({
      _id: {
        $in: ids
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
        if (type === 'binder' && item.id === p.id) {
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
          } else if (item.status === 0) {
            newWork.finished = 0;
            newWork.inProgress = 0;
          } else {
            if (type === 'traveler') {
              newWork.finished = 0;
              if (item.totalInput === 0) {
                newWork.inProgress = 1;
              } else {
                newWork.inProgress = item.finishedInput / item.totalInput;
              }
            } else {
              if (item.totalValue === 0) {
                newWork.finished = 0;
                newWork.inProgress = 1;
              } else {
                newWork.finished = item.finishedValue / item.totalValue;
                newWork.inProgress = item.inProgressValue / item.totalValue;
              }
            }

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

  app.post('/binders/:id/', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canWriteMw('id'), reqUtils.status('id', [0, 1]), reqUtils.filter('body', ['travelers', 'binders']), function (req, res) {
    addWork(req[req.params.id], req, res);
  });


  app.delete('/binders/:id/works/:wid', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canWriteMw('id'), reqUtils.status('id', [0, 1]), function (req, res) {
    var p = req[req.params.id];
    var work = p.works.id(req.params.wid);

    if (!work) {
      return res.send(404, 'Work ' + req.params.wid + ' not found in the binder.');
    }

    work.remove();
    p.updatedBy = req.session.userid;
    p.updatedOn = Date.now();

    p.updateProgress(function (err, newPackage) {
      if (err) {
        console.log(err);
        return res.send(500, err.message);
      }
      return res.json(newPackage);
    });

  });

  app.put('/binders/:id/works/', auth.ensureAuthenticated, reqUtils.exist('id', Binder), reqUtils.canWriteMw('id'), reqUtils.status('id', [0, 1]), function (req, res) {
    var binder = req[req.params.id];
    var works = binder.works;
    var updates = req.body;
    var wid;
    var work;
    var prop;
    var u;
    var valueChanged = false;
    for (wid in updates) {
      if (!updates.hasOwnProperty(wid)) {
        continue;
      }

      work = works.id(wid);
      if (!work) {
        continue;
      }

      u = updates[wid];
      for (prop in u) {
        if (!u.hasOwnProperty(prop)) {
          continue;
        }
        if (work[prop] !== u[prop]) {
          if (prop === 'value') {
            valueChanged = true;
          }
          work[prop] = u[prop];
        }
      }
    }

    if (!binder.isModified()) {
      return res.send(204);
    }

    var cb = function (err, newWP) {
      if (err) {
        console.error(err);
        return res.send(500, 'cannot save the updates to binder ' + binder._id);
      }
      res.json(200, newWP.works);
    };

    if (valueChanged) {
      binder.updateProgress(cb);
    } else {
      binder.save(cb);
    }

  });

  app.get('/publicbinders/', auth.ensureAuthenticated, function (req, res) {
    res.render('public-binders');
  });

  app.get('/publicbinders/json', auth.ensureAuthenticated, function (req, res) {
    Binder.find({
      publicAccess: {
        $in: [0, 1]
      },
      archived: {
        $ne: true
      }
    }).exec(function (err, binders) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      res.json(200, binders);
    });
  });

};
