/* eslint-disable no-underscore-dangle */
/* eslint-disable consistent-return */
/* eslint-disable func-names */
const mongoose = require('mongoose');
const config = require('../config/config');

const { ad } = config;

const ldapClient = require('../lib/ldap-client');

const User = mongoose.model('User');
const Group = mongoose.model('Group');

const auth = require('../lib/auth');

const authConfig = config.auth;
const routesUtilities = require('../utilities/routes');

function listADGroups(req, res) {
  const query = req.query.term;
  let filter;
  const opts = {
    filter,
    attributes: ad.groupAttributes,
    scope: 'sub',
  };
  if (query && query.length > 0) {
    if (query[query.length - 1] === '*') {
      filter = ad.groupSearchFilter.replace('_id', query);
    } else {
      filter = ad.groupSearchFilter.replace('_id', `${query}*`);
    }
  } else {
    filter = ad.groupSearchFilter.replace('_id', '*');
  }
  ldapClient.search(ad.groupSearchBase, opts, false, function(err, result) {
    if (err) {
      return res.status(500).send(err.message);
    }
    if (result.length === 0) {
      return res.json([]);
    }
    return res.json(result);
  });
}

function addGroup(req, res) {
  let group;
  if (ad.groupSearchBase && ad.groupSearchBase.length > 0) {
    const nameFilter = ad.nameFilter.replace('_name', req.body.name);
    const opts = {
      filter: nameFilter,
      attributes: ad.objAttributes,
      scope: 'sub',
    };

    ldapClient.search(ad.groupSearchBase, opts, false, function(
      ldapErr,
      result
    ) {
      if (ldapErr) {
        console.error(`${ldapErr.name} : ${ldapErr.message}`);
        return res.status(500).json(ldapErr);
      }

      if (result.length === 0) {
        return res.status(404).send(`${req.body.name} is not found in AD!`);
      }

      if (result.length > 1) {
        return res.status(400).send(`${req.body.name} is not unique!`);
      }
      const roles = [];
      if (req.body.manager) {
        roles.push('manager');
      }
      if (req.body.admin) {
        roles.push('admin');
      }
      group = new Group({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        office: result[0].physicalDeliveryOfficeName,
        phone: result[0].telephoneNumber.toString(),
        mobile: result[0].mobile,
        roles,
      });
    });
  } else {
    group = new Group({
      _id: req.body.name.toLowerCase(),
      name: req.body.name,
    });
  }

  group.save(function(err, newGroup) {
    if (err) {
      console.error(err);
      return res.status(500).send(err.message);
    }
    const url = `${
      req.proxied ? authConfig.proxied_service : authConfig.service
    }/groups/${newGroup._id}`;
    res.set('Location', url);
    return res
      .status(201)
      .send(`The new group is at <a target="_blank" href="${url}">${url}</a>`);
  });
}

module.exports = function(app) {
  app.get('/groupnames/:name', auth.ensureAuthenticated, function(req, res) {
    Group.findOne({
      name: req.params.name,
    }).exec(function(err, group) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (group) {
        return res.render(
          'group',
          routesUtilities.getRenderObject(req, {
            group,
            myRoles: req.session.roles,
          })
        );
      }
      return res.status(404).send(`${req.params.name} not found`);
    });
  });

  app.post('/groups/', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res.status(403).send('only admin allowed');
    }

    if (!req.body.name) {
      return res.status(400).send('need to know name');
    }

    // check if already in db
    Group.findOne({
      name: req.body.name,
    }).exec(function(err, group) {
      if (err) {
        return res.status(500).send(err.message);
      }
      if (group) {
        const url = `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/groups/${group._id}`;
        return res
          .status(200)
          .send(`The group is at <a target="_blank" href="${url}">${url}</a>`);
      }
      addGroup(req, res);
    });
  });

  app.get('/groups/json', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }

    if (ad.groupSearchFilter) {
      return listADGroups(req, res);
    }

    Group.find(req.query)
      .populate('members')
      .exec(function(err, groups) {
        if (err) {
          console.error(err);
          return res.status(500).json({
            error: err.message,
          });
        }
        return res.json(groups);
      });
  });

  app.get('/groups/:id', auth.ensureAuthenticated, function(req, res) {
    Group.findOne({
      _id: req.params.id,
    }).exec(function(err, group) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (group) {
        return res.render(
          'group',
          routesUtilities.getRenderObject(req, {
            group,
            myRoles: req.session.roles,
          })
        );
      }
      return res.status(404).send(`Group ${req.params.id} does not exist`);
    });
  });

  app.put('/groups/:id', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    if (!req.is('json')) {
      return res.status(415).json({
        error: 'json request expected.',
      });
    }
    Group.findOneAndUpdate(
      {
        _id: req.params.id,
      },
      req.body
    ).exec(function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: err.message,
        });
      }
      return res.status(204).send();
    });
  });

  app.put('/groups/:id/addmember/:user', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    const fullname = req.params.user;
    if (!fullname || fullname.length === 0) {
      return res.status(403).send("You must provide a user's full name");
    }
    const nameFilter = ad.nameFilter.replace('_name', fullname);
    const opts = {
      filter: nameFilter,
      attributes: ad.memberAttributes,
      paged: { pageSize: 10 },
      scope: 'sub',
    };
    ldapClient.search(ad.searchBase, opts, false, function(err, result) {
      if (err) {
        return res.status(500).send(err);
      }
      if (result.length === 0) {
        return res.status(404).send(`No user with name ${fullname}`);
      }
      if (result.length > 1) {
        return res.status(403).send(`User ${fullname} is not unique`);
      }
      const uid = result[0].sAMAccountName.toLowerCase();
      if (uid.length === 0) {
        return res
          .status(404)
          .send(`Could not find user with name ${req.params.user}`);
      }

      // If user isn't already in user table, store it with no special roles.
      User.findOne({ _id: uid }, function(err1, user) {
        if (err1) {
          return res
            .status(500)
            .send('Error finding user; please check configuration');
        }
        if (!user) {
          const newUser = new User({
            _id: uid,
            name: result[0].displayName,
            email: result[0].mail,
            office: result[0].physicalDeliveryOfficeName,
            phone: result[0].telephoneNumber.toString(),
            mobile: result[0].mobile,
            roles: [],
          });

          newUser.save(function(err2) {
            if (err2) {
              console.error(err2);
              return res.status(500).send(err2.message);
            }
          });
        }
      });

      Group.findOne({ _id: req.params.id }, function(err1, group) {
        if (err1) {
          console.error(err1);
          return res.status(500).json({ error: err1.message });
        }
        if (!group) {
          return res
            .status(404)
            .json({ error: `Cannot find group with id ${req.params.id}` });
        }
        const theuid = group.members.find(function(name) {
          return name === uid;
        });
        if (theuid) {
          // silent failure when user is already in group
          return res.status(204).send();
        }
        group.members.push(uid);
        Group.findOneAndUpdate(
          {
            _id: req.params.id,
          },
          { members: group.members }
        ).exec(function(err2) {
          if (err2) {
            console.error(err2);
            return res.status(500).json({
              error: err2.message,
            });
          }
          return res.status(204).send();
        });
      });
    });
  });

  app.put('/groups/:id/removeMembers', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    const data = req.body;
    if (!data || data.length === 0) {
      return res.status(403).send('You must provide at least one userid');
    }
    Group.findOne({ _id: req.params.id }, function(err, group) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      if (!group) {
        return res
          .status(404)
          .json({ error: `Cannot find group with id ${req.params.id}` });
      }
      const members = group.members.filter(function(name) {
        return (
          data.findIndex(function(member) {
            return member._id === name;
          }) === -1
        );
      });
      Group.findOneAndUpdate(
        {
          _id: req.params.id,
        },
        { members }
      ).exec(function(err1) {
        if (err1) {
          console.error(err1);
          return res.status(500).json({
            error: err1.message,
          });
        }
        return res.status(204).send();
      });
    });
  });

  app.delete('/groups/:id', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    if (!req.is('json')) {
      return res.status(415).json({
        error: 'json request expected.',
      });
    }
    Group.findOneAndUpdate(
      {
        _id: req.params.id,
      },
      { deleted: true }
    ).exec(function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: err.message,
        });
      }
      return res.status(204).send();
    });
  });

  // get from the db not ad
  app.get('/groups/:id/json', auth.ensureAuthenticated, function(req, res) {
    Group.findOne({
      _id: req.params.id,
    }).exec(function(err, group) {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: err.message,
        });
      }
      return res.json(group);
    });
  });

  app.get('/groups/:id/members/json', auth.ensureAuthenticated, function(
    req,
    res
  ) {
    Group.findOne({
      _id: req.params.id,
    })
      .populate('members')
      .exec(function(err, group) {
        if (err) {
          console.error(err);
          return res.status(500).json({
            error: err.message,
          });
        }
        if (group === null) {
          return res.status(404);
        }
        return res.json(group.members);
      });
  });

  /* this route was not implemented
  app.get('/groups/:id/refresh', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    Group.findOne({
      _id: req.params.id,
    }).exec(function(err, group) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (group) {
        updateGroupProfile(group, res);
      } else {
        return res
          .status(404)
          .send(`${req.params.id  } is not in the application.`);
      }
    });
  });
  */

  // resource /adgroups

  app.get('/adgroups/', auth.ensureAuthenticated, function(req, res) {
    return res.status(200).send('Please provide the group id');
  });

  app.get('/adgroups/:id', auth.ensureAuthenticated, function(req, res) {
    const searchFilter = ad.searchFilter.replace('_id', req.params.id);
    const opts = {
      filter: searchFilter,
      attributes: ad.objAttributes,
      scope: 'sub',
    };
    ldapClient.search(ad.searchBase, opts, false, function(err, result) {
      if (err) {
        return res.status(500).json(err);
      }
      if (result.length === 0) {
        return res.status(500).json({
          error: `${req.params.id} is not found!`,
        });
      }
      if (result.length > 1) {
        return res.status(500).json({
          error: `${req.params.id} is not unique!`,
        });
      }

      return res.json(result[0]);
    });
  });

  /* this route was not implemented
  app.get('/adgroups/:id/photo', auth.ensureAuthenticated, function(req, res) {
    if (fs.existsSync(`${options.root + req.params.id  }.jpg`)) {
      return res.sendFile(`${req.params.id  }.jpg`, options);
    } if (pending_photo[req.params.id]) {
      pending_photo[req.params.id].push(res);
    } else {
      pending_photo[req.params.id] = [res];
      fetch_photo_from_ad(req.params.id);
    }
  });
  */

  app.get('/groupnames', auth.ensureAuthenticated, function(req, res) {
    if (ad.groupSearchFilter) {
      return listADGroups(req, res);
    }

    Group.find().exec(function(err, groups) {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: err.message,
        });
      }
      return res.json(groups);
    });
  });

  app.get('/adgroups', auth.ensureAuthenticated, function(req, res) {
    return listADGroups(req, res);
  });
};
