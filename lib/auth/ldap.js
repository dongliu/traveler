var mongoose = require('mongoose');
const logger = require('../loggers').getLogger();

const ldapClient = require('../ldap-client.js');
const config = require('../../config/config.js');
const getPermissions = require('../permission.js').getPermissions;

const configPath = config.configPath;
const ad = config.ad;
const auth = config.auth;

const ldapLookup = auth.type === 'ldapWithDnLookup';

const ldapLoginService = '/ldaplogin/';

var User = mongoose.model('User');
var Group = mongoose.model('Group');

const clientOptions = {
  url: ad.url,
  maxConnections: 5,
  connectTimeout: 10 * 1000,
  timeout: 15 * 1000,
};
if (ad.ldapsCA !== undefined) {
  const fs = require('fs');
  clientOptions.tlsOptions = {
    ca: fs.readFileSync(configPath + '/' + ad.ldapsCA),
    rejectUnauthorized: ad.ldapsRejectUnauthorized,
  };
}

async function login(req, res, next) {
  var username = req.body.username;
  username = username.toLowerCase();
  var password = req.body.password;

  var baseDN = ad.searchBase;
  var bindDN;
  if (ldapLookup) {
    try {
      bindDN = await new Promise((res, rej) => {
        ldapClient.searchForUser(username, function(err, ldapUser) {
          console.log('err = %s', err);
          if (err !== null) {
            rej(err);
          } else {
            res(ldapUser.dn);
          }
        });
      });
    } catch (err) {
      console.log(err.message);
      res.locals.error = 'Invalid username or password was provided.';
      return next();
    }
  } else {
    bindDN = 'uid=' + username + ',' + baseDN;
  }
  ldapClient.getClient(clientOptions, function(localLdapClient, cleanUp) {
    localLdapClient.bind(bindDN, password, function(err) {
      cleanUp();
      if (err == null) {
        req.session.userid = username;

        var destination = '/';
        if (req.session.landing != null) {
          destination = req.session.landing;
          req.session.landing = undefined;
        }

        User.findOne({
          _id: username,
        }).exec(function(err, user) {
          if (err) {
            console.error(err.message);
          }
          if (user) {
            // update user last visited on
            User.findByIdAndUpdate(
              user._id,
              {
                lastVisitedOn: Date.now(),
              },
              function(err) {
                if (err) {
                  console.error(err.message);
                  next();
                } else {
                  res.redirect(destination);
                }
              }
            );
          } else {
            // create a new user
            /**
             * stop persist default roles to db
             * default roles are defined in config
             * default roles and hence permissions from those roles cannot be removed by touching the db
             */
            const default_roles = [];
            // if (auth.default_roles !== undefined) {
            //   default_roles = auth.default_roles;
            // }
            ldapClient.searchForUser(username, function(err, result) {
              if (err !== null) {
                console.log(err.message);
                res.locals.error = 'Invalid username or password was provided.';
                return next();
              } else {
                var first = new User({
                  _id: username,
                  name: result.displayName,
                  email: result.mail,
                  office: result.physicalDeliveryOfficeName,
                  phone: result.telephoneNumber.toString(),
                  mobile: result.mobile,
                  roles: default_roles,
                  lastVisitedOn: Date.now(),
                });

                // Check if current group exists
                if (ad.groupSearchBase === undefined) {
                  //Try using user info to add a new group if needed.
                  Group.findOne({
                    name: result.memberOf,
                  })
                    .lean()
                    .exec(function(err, group) {
                      if (err) {
                        console.error(err.msg);
                      } else if (group === undefined) {
                        var newGroup = new Group({
                          _id: [result.memberOf],
                          name: result.memberOf,
                          forms: [],
                          travelers: [],
                        });

                        newGroup.save(function(err, createdGroup) {
                          if (err) {
                            console.error(err.msg);
                          } else {
                            console.info(
                              'A new group created: ' + createdGroup.name
                            );
                          }
                        });
                      }
                    });
                }

                first.save(function(err, newUser) {
                  if (err) {
                    console.error(err);
                    console.error(newUser.toJSON());
                    return res
                      .status(500)
                      .send('Cannot log in. Please contact the admin. Thanks.');
                  }
                  console.info('A new user created : ' + newUser.name);
                  res.redirect(destination);
                });
              }
            });
          }
        });
      } else {
        var error = '';
        //Do not notify the user if the username is valid
        if (
          err.name === 'NoSuchObjectError' ||
          err.name === 'InvalidCredentialsError'
        ) {
          error = 'Invalid username or password was provided.';
        } else {
          error = err.name;
        }
        res.locals.error = error;
        next();
      }
    });
  });
}

function ensureAuthenticated(req, res, next) {
  if (req.session.userid == null) {
    req.session.landing = req.url;
    res.redirect(ldapLoginService);
    return;
  }

  User.findOne({ _id: req.session.userid }, function(err, user) {
    if (err != null || user == null) {
      console.error(err.message || 'User not found');
      res.redirect(ldapLoginService);
    } else {
      res.locals.userid = user._id;
      res.locals.username = user.name;
      // union the roles
      const roleSet = new Set([...auth.default_roles, ...user.roles]);
      res.locals.roles = Array.from(roleSet);
      logger.debug(`${req.session.userid} roles: `, res.locals.roles);
      res.locals.permissions = getPermissions(res.locals.roles);
      logger.debug(
        `${req.session.userid} permissions: `,
        res.locals.permissions
      );
      next();
    }
  });
}

module.exports = { login, ensureAuthenticated };
