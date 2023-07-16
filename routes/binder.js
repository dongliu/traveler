/* eslint-disable no-underscore-dangle */
/* eslint-disable func-names */
/* eslint-disable consistent-return */
/* eslint max-nested-callbacks: [2, 4], complexity: [2, 20] */

const mongoose = require('mongoose');
const _ = require('lodash');
const jade = require('jade');
const auth = require('../lib/auth');
const authConfig = require('../config/config').auth;
const reqUtils = require('../lib/req-utils');
const shareLib = require('../lib/share');
const routesUtilities = require('../utilities/routes');

const valueProgressHtml = jade.compileFile(
  `${__dirname}/../views/binder-value-progress.jade`
);
const travelerProgressHtml = jade.compileFile(
  `${__dirname}/../views/binder-traveler-progress.jade`
);
const inputProgressHtml = jade.compileFile(
  `${__dirname}/../views/binder-input-progress.jade`
);

const User = mongoose.model('User');
const Group = mongoose.model('Group');
const Binder = mongoose.model('Binder');
const Traveler = mongoose.model('Traveler');

module.exports = function(app) {
  app.get('/binders/', auth.ensureAuthenticated, function(req, res) {
    res.render('binders', routesUtilities.getRenderObject(req));
  });

  app.get('/binders/json', auth.ensureAuthenticated, function(req, res) {
    Binder.find({
      createdBy: req.session.userid,
      status: {
        $ne: 3,
      },
      owner: {
        $exists: false,
      },
    }).exec(function(err, docs) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      return res.status(200).json(docs);
    });
  });

  app.get(
    '/binders/:id/config',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canWriteMw('id'),
    function(req, res) {
      return res.render(
        'binder-config',
        routesUtilities.getRenderObject(req, {
          binder: req[req.params.id],
        })
      );
    }
  );

  app.post(
    '/binders/:id/tags/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canWriteMw('id'),
    reqUtils.filter('body', ['newtag']),
    reqUtils.sanitize('body', ['newtag']),
    function(req, res) {
      const doc = req[req.params.id];
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.tags.addToSet(req.body.newtag);
      doc.save(function(saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res.status(204).send();
      });
    }
  );

  app.delete(
    '/binders/:id/tags/:tag',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canWriteMw('id'),
    function(req, res) {
      const doc = req[req.params.id];
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.tags.pull(req.params.tag);
      doc.save(function(saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res.status(204).send();
      });
    }
  );

  app.put(
    '/binders/:id/config',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    reqUtils.status('id', [0, 1]),
    reqUtils.filter('body', ['title', 'description']),
    reqUtils.sanitize('body', ['title', 'description']),
    function(req, res) {
      const doc = req[req.params.id];
      Object.keys(req.body).forEach(k => {
        if (req.body[k] !== null) {
          doc[k] = req.body[k];
        }
      });
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function(saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res.status(204).send();
      });
    }
  );

  app.get(
    '/binders/:id/share/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const binder = req[req.params.id];
      return res.render(
        'share',
        routesUtilities.getRenderObject(req, {
          type: 'Binder',
          id: req.params.id,
          title: binder.title,
          access: String(binder.publicAccess),
        })
      );
    }
  );

  app.put(
    '/binders/:id/share/public',
    auth.ensureAuthenticated,
    reqUtils.filter('body', ['access']),
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const binder = req[req.params.id];
      let { access } = req.body;
      if (['-1', '0', '1'].indexOf(access) === -1) {
        return res.status(400).send('not valid value');
      }
      access = Number(access);
      if (binder.publicAccess === access) {
        return res.status(204).send();
      }
      binder.publicAccess = access;
      binder.save(function(saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res
          .status(200)
          .send(`public access is set to ${req.body.access}`);
      });
    }
  );

  app.get(
    '/binders/:id/share/:list/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canReadMw('id'),
    function(req, res) {
      const binder = req[req.params.id];
      if (req.params.list === 'users') {
        return res.status(200).json(binder.sharedWith || []);
      }
      if (req.params.list === 'groups') {
        return res.status(200).json(binder.sharedGroup || []);
      }
      return res.status(400).send('unknown share list.');
    }
  );

  app.post(
    '/binders/:id/share/:list/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const binder = req[req.params.id];
      let share = -2;
      if (req.params.list === 'users') {
        if (req.body.name) {
          share = reqUtils.getSharedWith(binder.sharedWith, req.body.name);
        } else {
          return res.status(400).send('user name is empty.');
        }
      }
      if (req.params.list === 'groups') {
        if (req.body.id) {
          share = reqUtils.getSharedGroup(binder.sharedGroup, req.body.id);
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

      if (share === -1) {
        // new user in the list
        shareLib.addShare(req, res, binder);
      }
    }
  );

  app.put(
    '/binders/:id/share/:list/:shareid',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const binder = req[req.params.id];
      let share;
      if (req.params.list === 'users') {
        share = binder.sharedWith.id(req.params.shareid);
      }
      if (req.params.list === 'groups') {
        share = binder.sharedGroup.id(req.params.shareid);
      }

      if (!share) {
        // the user should in the list
        return res
          .status(404)
          .send(`cannot find ${req.params.shareid} in the list.`);
      }

      // change the access
      if (req.body.access && req.body.access === 'write') {
        share.access = 1;
      } else {
        share.access = 0;
      }
      binder.save(function(saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        // check consistency of user's traveler list
        let Target;
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
              binders: binder._id,
            },
          },
          function(updateErr, target) {
            if (updateErr) {
              console.error(updateErr);
            }
            if (!target) {
              console.error(
                `The user/group ${req.params.userid} is not in the db`
              );
            }
          }
        );
        return res.status(200).json(share);
      });
    }
  );

  app.delete(
    '/binders/:id/share/:list/:shareid',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    function(req, res) {
      const binder = req[req.params.id];
      shareLib.removeShare(req, res, binder);
    }
  );

  app.get('/binders/new', auth.ensureAuthenticated, function(req, res) {
    res.render('binder-new', routesUtilities.getRenderObject(req));
  });

  app.post(
    '/binders/',
    auth.ensureAuthenticated,
    reqUtils.filter('body', ['title', 'description']),
    reqUtils.hasAll('body', ['title']),
    reqUtils.sanitize('body', ['title', 'description']),
    function(req, res) {
      const binder = {};
      if (req.body.works && _.isArray(req.body.works)) {
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
      new Binder(binder).save(function(err, newPackage) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        const url = `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/binders/${newPackage.id}/`;

        res.set('Location', url);
        return res
          .status(201)
          .send(`You can access the new binder at <a href="${url}">${url}</a>`);
      });
    }
  );

  app.get('/transferredbinders/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    Binder.find({
      owner: req.session.userid,
      status: {
        $ne: 3,
      },
    }).exec(function(err, binders) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(binders);
    });
  });

  app.get('/writablebinders/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    const search = {
      status: {
        $ne: 3,
      },
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
        {
          publicAccess: 1,
        },
        {
          sharedWith: {
            $elemMatch: {
              _id: req.session.userid,
              access: 1,
            },
          },
        },
        {
          sharedGroup: {
            $elemMatch: {
              _id: { $in: req.session.memberOf },
              access: 1,
            },
          },
        },
      ],
    };

    Binder.find(search)
      .lean()
      .exec(function(err, binders) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        return res.status(200).json(binders);
      });
  });

  app.get('/sharedbinders/json', auth.ensureAuthenticated, function(req, res) {
    User.findOne(
      {
        _id: req.session.userid,
      },
      'binders'
    ).exec(function(err, me) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (!me) {
        return res.status(400).send('cannot identify the current user');
      }
      Binder.find({
        _id: {
          $in: me.binders,
        },
        status: {
          $ne: 3,
        },
      }).exec(function(pErr, binders) {
        if (pErr) {
          console.error(pErr);
          return res.status(500).send(pErr.message);
        }
        return res.status(200).json(binders);
      });
    });
  });

  app.get('/groupsharedbinders/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    Group.find(
      {
        _id: {
          $in: req.session.memberOf,
        },
      },
      'binders'
    ).exec(function(err, groups) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      const binderIds = [];
      let i;
      let j;
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
          $in: binderIds,
        },
      }).exec(function(pErr, binders) {
        if (pErr) {
          console.error(pErr);
          return res.status(500).send(pErr.message);
        }
        res.status(200).json(binders);
      });
    });
  });

  app.get('/archivedbinders/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    Binder.find({
      createdBy: req.session.userid,
      status: 3,
    }).exec(function(err, binders) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      return res.status(200).json(binders);
    });
  });

  app.put(
    '/binders/:id/owner',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    reqUtils.status('id', [0, 1]),
    reqUtils.filter('body', ['name']),
    function(req, res) {
      const doc = req[req.params.id];
      shareLib.changeOwner(req, res, doc);
    }
  );

  app.get(
    '/binders/:id/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canReadMw('id'),
    function(req, res) {
      res.render(
        'binder',
        routesUtilities.getRenderObject(req, {
          binder: req[req.params.id],
        })
      );
    }
  );

  app.get(
    '/binders/:id/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canReadMw('id'),
    reqUtils.exist('id', Binder),
    function(req, res) {
      res.status(200).json(req[req.params.id]);
    }
  );

  app.put(
    '/binders/:id/status',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.isOwnerMw('id'),
    reqUtils.filter('body', ['status']),
    reqUtils.hasAll('body', ['status']),
    function(req, res) {
      const p = req[req.params.id];
      const s = req.body.status;

      if ([1, 2, 3].indexOf(s) === -1) {
        return res.status(400).send('invalid status');
      }

      if (p.status === s) {
        return res.status(204).send();
      }

      if (s === 1) {
        if ([0, 2].indexOf(p.status) === -1) {
          return res.status(400).send('invalid status change');
        }
      }

      if (s === 2) {
        if ([1].indexOf(p.status) === -1) {
          return res.status(400).send('invalid status change');
        }
      }
      p.status = s;
      p.save(function(err) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        return res.status(200).send(`status updated to ${s}`);
      });
    }
  );

  function sendMerged(t, p, res, merged, binder) {
    if (t && p) {
      if (binder.isModified()) {
        binder.updateProgress();
      }
      res.status(200).json({
        works: merged,
        inputProgress: inputProgressHtml({ binder }),
        travelerProgress: travelerProgressHtml({ binder }),
        valueProgress: valueProgressHtml({ binder }),
      });
    }
  }

  app.get(
    '/binders/:id/works/json',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canReadMw('id'),
    async function getWorks(req, res) {
      const binder = req[req.params.id];
      const { works } = binder;

      const tids = [];
      const pids = [];

      works.forEach(function(w) {
        if (w.refType === 'traveler') {
          tids.push(w._id);
        } else {
          pids.push(w._id);
        }
      });

      const merged = [];
      if (tids.length !== 0) {
        try {
          const travelers = await Traveler.find(
            {
              _id: {
                $in: tids,
              },
            },
            'title mapping devices tags locations manPower status createdBy owner sharedWith finishedInput totalInput'
          )
            .lean()
            .exec();
          travelers.forEach(function(t) {
            // works has its own toJSON, therefore need to merge only the plain object
            _.extend(t, works.id(t._id).toJSON());
            merged.push(t);
          });
        } catch (error) {
          res.status(500).send(error.message);
        }
      }

      if (pids.length !== 0) {
        try {
          const binders = await Binder.find(
            {
              _id: {
                $in: pids,
              },
            },
            'title tags status createdBy owner finishedValue inProgressValue totalValue finishedInput totalInput'
          )
            .lean()
            .exec();
          binders.forEach(function(b) {
            _.extend(b, works.id(b._id).toJSON());
            merged.push(b);
          });
        } catch (error) {
          res.status(500).send(error.message);
        }
      }

      return res.status(200).json({
        works: merged,
        inputProgress: inputProgressHtml({ binder }),
        travelerProgress: travelerProgressHtml({ binder }),
        valueProgress: valueProgressHtml({ binder }),
      });
    }
  );

  app.post(
    '/binders/:id/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canWriteMw('id'),
    reqUtils.status('id', [0, 1]),
    reqUtils.filter('body', ['ids', 'type']),
    reqUtils.hasAll('body', ['ids', 'type']),
    function(req, res) {
      routesUtilities.binder.addWork(
        req[req.params.id],
        req.session.userid,
        req,
        res
      );
    }
  );

  app.delete(
    '/binders/:id/works/:wid',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canWriteMw('id'),
    reqUtils.status('id', [0, 1]),
    function(req, res) {
      const p = req[req.params.id];
      const work = p.works.id(req.params.wid);

      if (!work) {
        return res
          .status(404)
          .send(`Work ${req.params.wid} not found in the binder.`);
      }

      work.remove();
      p.updatedBy = req.session.userid;
      p.updatedOn = Date.now();

      p.updateProgress(function(err, newPackage) {
        if (err) {
          console.log(err);
          return res.status(500).send(err.message);
        }
        return res.json(newPackage);
      });
    }
  );

  app.put(
    '/binders/:id/works/',
    auth.ensureAuthenticated,
    reqUtils.exist('id', Binder),
    reqUtils.canWriteMw('id'),
    reqUtils.status('id', [0, 1]),
    function(req, res) {
      const binder = req[req.params.id];
      const { works } = binder;
      const updates = req.body;
      let valueChanged = false;
      Object.keys(updates).forEach(wid => {
        const work = works.id(wid);
        if (!work) {
          return;
        }
        const u = updates[wid];
        Object.keys(u).forEach(p => {
          if (work[p] !== u[p]) {
            if (p === 'value') {
              valueChanged = true;
            }
            work[p] = u[p];
          }
        });
      });

      if (!binder.isModified()) {
        return res.status(204).send();
      }

      const cb = function(err, newWP) {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .send(`cannot save the updates to binder ${binder._id}`);
        }
        res.status(200).json(newWP.works);
      };

      if (valueChanged) {
        binder.updateProgress(cb);
      } else {
        binder.save(cb);
      }
    }
  );

  app.get('/publicbinders/', auth.ensureAuthenticated, function(req, res) {
    res.render('public-binders', routesUtilities.getRenderObject(req));
  });

  app.get('/publicbinders/json', auth.ensureAuthenticated, function(req, res) {
    Binder.find({
      publicAccess: {
        $in: [0, 1],
      },
      status: {
        $ne: 3,
      },
    }).exec(function(err, binders) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      res.status(200).json(binders);
    });
  });
};
