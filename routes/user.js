/* eslint-disable no-underscore-dangle */
/* eslint-disable consistent-return */
/* eslint-disable func-names */
const mongoose = require('mongoose');
const fs = require('fs');
const _ = require('lodash');
const config = require('../config/config');
const { Manager, Reviewer, Admin } = require('../lib/role');
const logger = require('../lib/loggers').getLogger();

const { ad } = config;

const ldapClient = require('../lib/ldap-client');

const User = mongoose.model('User');
const Group = mongoose.model('Group');

const auth = require('../lib/auth');

const authConfig = config.auth;
const routesUtilities = require('../utilities/routes');
const { Traveler } = require('../model/traveler');
const { Binder } = require('../model/binder');

const pending_photo = {};
const options = {
  root: `${__dirname}/../userphoto/`,
  maxAge: 30 * 24 * 3600 * 1000,
};

function cleanList(id, f) {
  const res_list = pending_photo[id];
  delete pending_photo[id];
  res_list.forEach(f);
}

function fetch_photo_from_ad(id) {
  const searchFilter = ad.searchFilter.replace('_id', id);
  const opts = {
    filter: searchFilter,
    attributes: ad.rawAttributes,
    scope: 'sub',
  };
  ldapClient.search(ad.searchBase, opts, true, function(err, result) {
    if (err) {
      console.error(err);
      cleanList(id, function(res) {
        return res.status(500).send('ldap error');
      });
    } else if (result.length === 0) {
      cleanList(id, function(res) {
        return res.status(400).send(`${id} is not found`);
      });
    } else if (result.length > 1) {
      cleanList(id, function(res) {
        return res.status(400).send(`${id} is not unique!`);
      });
    } else if (result[0].thumbnailPhoto && result[0].thumbnailPhoto.length) {
      if (!fs.existsSync(`${options.root + id}.jpg`)) {
        fs.writeFile(
          `${options.root + id}.jpg`,
          result[0].thumbnailPhoto,
          function(fsErr) {
            if (fsErr) {
              console.error(fsErr);
            }
            cleanList(id, function(res) {
              res.set('Content-Type', 'image/jpeg');
              res.set('Cache-Control', `public, max-age=${options.maxAge}`);
              return res.status(200).send(result[0].thumbnailPhoto);
            });
          }
        );
      } else {
        cleanList(id, function(res) {
          res.set('Content-Type', 'image/jpeg');
          res.set('Cache-Control', `public, max-age=${options.maxAge}`);
          return res.status(200).send(result[0].thumbnailPhoto);
        });
      }
    } else {
      cleanList(id, function(res) {
        return res.status(400).send(`${id} photo is not found`);
      });
    }
  });
}

function updateUserProfile(user, res) {
  const searchFilter = ad.searchFilter.replace('_id', user._id);
  const opts = {
    filter: searchFilter,
    attributes: ad.objAttributes,
    scope: 'sub',
  };
  ldapClient.search(ad.searchBase, opts, false, function(ldapErr, result) {
    if (ldapErr) {
      return res.status(500).json(ldapErr);
    }
    if (result.length === 0) {
      return res.status(500).json({
        error: `${user._id} is not found!`,
      });
    }
    if (result.length > 1) {
      return res.status(500).json({
        error: `${user._id} is not unique!`,
      });
    }
    user.update(
      {
        name: result[0].displayName,
        email: result[0].mail,
        office: result[0].physicalDeliveryOfficeName,
        phone: result[0].telephoneNumber.toString(),
        mobile: result[0].mobile,
      },
      function(err) {
        if (err) {
          return res.status(500).json(err);
        }
        return res.status(204).send();
      }
    );
  });
}

function addUser(req, res) {
  if (authConfig.type === 'ldapWithDnLookup') {
    ldapClient.searchForUser(req.body.name, function(err, ldapUser) {
      if (err !== null) {
        console.log(err.message);
        res.locals.error = 'Username not found.';
        return res.status(404).send(`Username ${req.body.name} not found.`);
      }
      // dn = ldapUser.dn;
      storeUser(req, res, ldapUser);
    });
  } else {
    const nameFilter = ad.nameFilter.replace('_name', req.body.name);
    const opts = {
      filter: nameFilter,
      attributes: ad.objAttributes,
      scope: 'sub',
    };

    ldapClient.search(ad.searchBase, opts, false, function(ldapErr, result) {
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

      storeUser(req, res, result[0]);
    });
  }
}

function storeUser(req, res, result) {
  const roles = [];
  if (req.body.manager) {
    roles.push(Manager);
  }
  if (req.body.reviewer) {
    roles.push(Reviewer);
  }
  if (req.body.admin) {
    roles.push(Admin);
  }
  const user = new User({
    _id: result.sAMAccountName.toLowerCase(),
    name: result.displayName,
    email: result.mail,
    office: result.physicalDeliveryOfficeName,
    phone: result.telephoneNumber.toString(),
    mobile: result.mobile,
    roles,
  });

  user.save(function(err, newUser) {
    if (err) {
      console.error(err);
      return res.status(500).send(err.message);
    }
    const url = `${
      req.proxied ? authConfig.proxied_service : authConfig.service
    }/users/${newUser._id}`;
    res.set('Location', url);
    return res
      .status(201)
      .send(`The new user is at <a target="_blank" href="${url}">${url}</a>`);
  });
}

module.exports = function(app) {
  app.get('/usernames/:name', auth.ensureAuthenticated, function(req, res) {
    User.findOne({
      name: req.params.name,
    }).exec(function(err, user) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (user) {
        return res.render(
          'user',
          routesUtilities.getRenderObject(req, {
            user,
            myRoles: req.session.roles,
          })
        );
      }
      return res.status(404).send(`${req.params.name} not found`);
    });
  });

  app.post('/users/', auth.ensureAuthenticated, function(req, res) {
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
    User.findOne({
      name: req.body.name,
    }).exec(function(err, user) {
      if (err) {
        return res.status(500).send(err.message);
      }
      if (user) {
        const url = `${
          req.proxied ? authConfig.proxied_service : authConfig.service
        }/users/${user._id}`;
        return res
          .status(200)
          .send(`The user is at <a target="_blank" href="${url}">${url}</a>`);
      }
      addUser(req, res);
    });
  });

  app.get('/users/json', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    User.find().exec(function(err, users) {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: err.message,
        });
      }
      res.json(users);
    });
  });

  app.get('/users/:id', auth.ensureAuthenticated, function(req, res) {
    User.findOne({
      _id: req.params.id,
    }).exec(function(err, user) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (user) {
        return res.render(
          'user',
          routesUtilities.getRenderObject(req, {
            user,
            myRoles: req.session.roles,
          })
        );
      }
      return res
        .status(404)
        .send(`${req.params.id} has never logged into the application.`);
    });
  });

  app.put('/users/:id', auth.ensureAuthenticated, function(req, res) {
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
    User.findOneAndUpdate(
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

  // get from the db not ad
  app.get('/users/:id/json', auth.ensureAuthenticated, function(req, res) {
    User.findOne({
      _id: req.params.id,
    }).exec(function(err, user) {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: err.message,
        });
      }
      return res.json(user);
    });
  });

  app.get('/users/:id/ownership', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    User.findOne({
      _id: req.params.id,
    }).exec(function(err, user) {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: err.message,
        });
      }
      if (user) {
        return res.render(
          'ownership',
          routesUtilities.getRenderObject(req, {
            user,
            myRoles: req.session.roles,
          })
        );
      }
      return res.status(404).send(`${req.params.name} not found`);
    });
  });

  app.get(
    '/users/:id/travelers/json',
    auth.ensureAuthenticated,
    auth.verifyRole(Admin),
    async function(req, res) {
      try {
        const user = await User.findOne({
          _id: req.params.id,
        }).exec();
        if (_.isEmpty(user)) {
          return res.status(404).send({
            error: `resource identified by ${req.params.id} not found`,
          });
        }
        const search = {
          status: {
            // not archived
            $ne: 4,
          },
          $or: [
            {
              createdBy: req.params.id,
              owner: {
                $exists: false,
              },
            },
            {
              owner: req.params.id,
            },
          ],
        };
        const travelers = await Traveler.find(
          search,
          'title description status devices tags sharedWith sharedGroup publicAccess locations createdOn deadline updatedOn updatedBy manPower finishedInput totalInput mapping'
        )
          .lean()
          .exec();
        return res.status(200).json(travelers);
      } catch (error) {
        logger.err(error);
        return res.status(500).json({ error: error.message });
      }
    }
  );

  app.get(
    '/users/:id/binders/json',
    auth.ensureAuthenticated,
    auth.verifyRole(Admin),
    async function(req, res) {
      try {
        const user = await User.findOne({
          _id: req.params.id,
        }).exec();
        if (_.isEmpty(user)) {
          return res.status(404).send({
            error: `resource identified by ${req.params.id} not found`,
          });
        }
        const search = {
          status: {
            // not archived
            $ne: 3,
          },
          $or: [
            {
              createdBy: req.params.id,
              owner: {
                $exists: false,
              },
            },
            {
              owner: req.params.id,
            },
          ],
        };
        const binders = await Binder.find(search)
          .lean()
          .exec();
        return res.status(200).json(binders);
      } catch (error) {
        logger.err(error);
        return res.status(500).json({ error: error.message });
      }
    }
  );

  app.get('/users/:id/refresh', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf('admin') === -1
    ) {
      return res
        .status(403)
        .send('You are not authorized to access this resource. ');
    }
    User.findOne({
      _id: req.params.id,
    }).exec(function(err, user) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (user) {
        updateUserProfile(user, res);
      } else {
        return res
          .status(404)
          .send(`${req.params.id} is not in the application.`);
      }
    });
  });

  // resource /adusers

  app.get('/adusers/', auth.ensureAuthenticated, function(req, res) {
    return res.status(200).send('Please provide the user id');
  });

  app.get('/adusers/:id', auth.ensureAuthenticated, function(req, res) {
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

  app.get('/adusers/:id/photo', auth.ensureAuthenticated, function(req, res) {
    if (fs.existsSync(`${options.root + req.params.id}.jpg`)) {
      return res.sendFile(`${req.params.id}.jpg`, options);
    }
    if (pending_photo[req.params.id]) {
      pending_photo[req.params.id].push(res);
    } else {
      pending_photo[req.params.id] = [res];
      fetch_photo_from_ad(req.params.id);
    }
  });

  app.get('/adusernames', auth.ensureAuthenticated, function(req, res) {
    const query = req.query.term;
    let nameFilter;
    if (query && query.length > 0) {
      nameFilter = ad.nameFilter.replace('_name', `${query}*`);
    } else {
      nameFilter = ad.nameFilter.replace('_name', '*');
    }
    const opts = {
      filter: nameFilter,
      attributes: ad.memberAttributes,
      paged: {
        pageSize: 200,
      },
      scope: 'sub',
    };
    ldapClient.search(ad.searchBase, opts, false, function(err, result) {
      if (err) {
        return res.status(500).json(err);
      }
      if (result.length === 0) {
        return res.json([]);
      }
      return res.json(result);
    });
  });

  app.get('/adgroups', auth.ensureAuthenticated, function(req, res) {
    const query = req.query.term;
    if (ad.groupSearchFilter && ad.groupAttributes && ad.groupSearchBase) {
      let filter;
      if (query && query.length > 0) {
        if (query[query.length - 1] === '*') {
          filter = ad.groupSearchFilter.replace('_id', query);
        } else {
          filter = ad.groupSearchFilter.replace('_id', `${query}*`);
        }
      } else {
        filter = ad.groupSearchFilter.replace('_id', '*');
      }
      const opts = {
        filter,
        attributes: ad.groupAttributes,
        scope: 'sub',
      };
      ldapClient.search(ad.groupSearchBase, opts, false, function(err, result) {
        if (err) {
          return res.status(500).send(err.message);
        }
        if (result.length === 0) {
          return res.json([]);
        }
        return res.json(result);
      });
    } else {
      Group.find({ name: `${query}*` }, function(err, groups) {
        return res.json(groups);
      });
    }
  });
};
