// authentication and authorization functions
const url = require('url');
const mongoose = require('mongoose');
const _ = require('lodash');

const debug = require('debug')('traveler:auth');
const util = require('util');

// Import configuration files
const basic = require('basic-auth');
const fs = require('fs');
const Client = require('cas.js');
const config = require('../config/config');

const { configPath } = config;

const { ad } = config;
const { auth } = config;
const { alias } = config;

const ldapClient = require('./ldap-client');

const apiUsers = config.api.api_users;

let cas;

const ldapLoginService = '/ldaplogin/';
const ldapLookup = auth.type === 'ldapWithDnLookup';
const clientOptions = {
  url: ad.url,
  maxConnections: 5,
  connectTimeout: 10 * 1000,
  timeout: 15 * 1000,
};

if (auth.type === 'cas') {
  // validation of ticket is with the lan, and therefore url does not need to be proxied.
  cas = new Client({
    base_url: auth.cas,
    service: auth.login_service,
    version: 1.0,
  });
} else if (auth.type === 'ldap' || auth.type === 'ldapWithDnLookup') {
  if (ad.ldapsCA !== undefined) {
    clientOptions.tlsOptions = {
      ca: fs.readFileSync(`${configPath}/${ad.ldapsCA}`),
      rejectUnauthorized: ad.ldapsRejectUnauthorized,
    };
  }
}

const User = mongoose.model('User');
const Group = mongoose.model('Group');

function proxied(req, res, next) {
  if (
    req.get('x-forwarded-host') &&
    req.get('x-forwarded-host') === auth.proxy
  ) {
    req.proxied = true;
    req.proxied_prefix = url.parse(auth.proxied_service).pathname;
  }
  next();
}

function cn(s) {
  const first = s.split(',', 1)[0];
  return first.substr(3).toLowerCase();
}

function filterGroup(a) {
  const output = [];
  let i;
  let group;
  for (i = 0; i < a.length; i += 1) {
    group = cn(a[i]);
    if (group.indexOf('lab.frib') === 0) {
      output.push(group);
      if (alias.hasOwnProperty(group) && output.indexOf(alias[group]) === -1) {
        output.push(alias[group]);
      }
    }
  }
  return output;
}

function ensureAuthenticated(req, res, next) {
  debug(util.inspect(req.session));
  if (auth.type === 'cas') {
    return casEnsureAuthenticated(req, res, next);
  }
  if (auth.type.startsWith('ldap')) {
    return ldapEnsureAuthenticated(req, res, next);
  }
  return redirectToLoginService(req, res);
}

function ldapEnsureAuthenticated(req, res, next) {
  if (req.session.userid) {
    // logged in already
    debug('user already logged in');
    return next();
  }
  if (req.originalUrl !== ldapLoginService) {
    // Not on the login page currently so redirect user to login page
    return redirectToLoginService(req, res);
  }
  // POST method once the user submits the login form.
  console.log('perform authentication');
  // Perform authentication
  let { username } = req.body;
  username = username.toLowerCase();
  const { password } = req.body;

  const baseDN = ad.searchBase;
  if (ldapLookup) {
    ldapClient.searchForUser(username, function(err, ldapUser) {
      if (err !== null) {
        console.log(err.message);
        res.locals.error = 'Invalid username or password was provided.';
        return next();
      }
      return authenticateUsingLdap(
        ldapUser.dn,
        username,
        password,
        req,
        res,
        next
      );
    });
  } else {
    const bindDN = `uid=${username},${baseDN}`;
    return authenticateUsingLdap(bindDN, username, password, req, res, next);
  }
  return redirectToLoginService(req, res);
}

function authenticateUsingLdap(bindDN, username, password, req, res, next) {
  ldapClient.getClient(clientOptions, function(localLdapClient, cleanUp) {
    localLdapClient.bind(bindDN, password, function(err) {
      cleanUp();
      if (err === null) {
        authenticationSucceeded(username, req, res);
      } else {
        let error = '';
        // Do not notify the user if the username is valid
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

function authenticationSucceeded(username, req, res) {
  getCurrentUser(username, req, res, function() {
    req.session.userid = username;
    if (req.session.landing === undefined) {
      redirectService(res, req, '/');
    } else {
      const { landing } = req.session;
      req.session.landing = undefined;
      redirectService(res, req, landing);
    }
  });
}

function casEnsureAuthenticated(req, res, next) {
  // console.log(req.session);
  const ticketUrl = url.parse(req.url, true);
  if (req.session.userid) {
    // logged in already
    if (req.query.ticket) {
      // remove the ticket query param
      delete ticketUrl.query.ticket;
      return res.redirect(
        301,
        url.format({
          pathname: req.proxied
            ? url.resolve(`${auth.proxied_service}/`, `.${ticketUrl.pathname}`)
            : ticketUrl.pathname,
          query: ticketUrl.query,
        })
      );
    }
    next();
  } else if (req.query.ticket) {
    // just kicked back by CAS
    // var halt = pause(req);
    if (req.proxied) {
      cas.service = auth.login_proxied_service;
    } else {
      cas.service = auth.login_service;
    }

    const cas_hostname = cas.hostname.split(':');
    if (cas_hostname.length === 2) {
      [cas.hostname, cas.port] = cas_hostname;
    }

    // validate the ticket
    cas.validate(req.query.ticket, function(err, casresponse, result) {
      if (err) {
        console.error(err.message);
        return res.status(401).send(err.message);
      }
      if (result.validated) {
        const userid = result.username;
        // set userid in session
        req.session.userid = userid;

        getCurrentUser(userid, req, res, function() {
          if (req.session.landing && req.session.landing !== '/login') {
            return res.redirect(
              req.proxied
                ? url.resolve(
                    `${auth.proxied_service}/`,
                    `.${req.session.landing}`
                  )
                : req.session.landing
            );
          }
          // has a ticket but not landed before, must copy the ticket from somewhere ...
          return res.redirect(req.proxied ? auth.proxied_service : '/');
          // halt.resume();
        });
      }
      console.error('CAS reject this ticket');
      return res.redirect(
        req.proxied ? auth.login_proxied_service : auth.login_service
      );
    });
  }
  return redirectToLoginService(req, res);
}

function redirectToLoginService(req, res) {
  if (auth.type === 'cas') {
    // if this is ajax call, then send 401 without redirect
    if (req.xhr) {
      // TODO: might need to properly set the WWW-Authenticate header
      res.set(
        'WWW-Authenticate',
        `CAS realm="${req.proxied ? auth.proxied_service : auth.service}"`
      );
      res.status(401).send('xhr cannot be authenticated');
    } else {
      // set the landing, the first unauthenticated url
      req.session.landing = req.url;
      if (req.proxied) {
        res.redirect(
          `${auth.proxied_cas}/login?service=${encodeURIComponent(
            auth.login_proxied_service
          )}`
        );
      } else {
        res.redirect(
          `${auth.cas}/login?service=${encodeURIComponent(auth.login_service)}`
        );
      }
    }
  } else if (auth.type.startsWith('ldap')) {
    // ldap
    if (req.xhr) {
      res.status(401).send('xhr cannot be authenticated');
    } else {
      req.session.landing = req.originalUrl;
      redirectService(res, req, ldapLoginService);
    }
  }
}

function redirectService(res, req, destination) {
  if (req.proxied) {
    res.redirect(auth.proxied_service + destination);
  } else {
    res.redirect(auth.service + destination);
  }
}

function getCurrentUser(userid, req, res, cb) {
  userid = userid.toLowerCase();
  // query ad about other attribute
  return ldapClient.searchForUser(userid, function(err, result) {
    if (err) {
      if (err instanceof Error) {
        console.error(`${err.name} : ${err.message}`);
        return res.status(500).send('something wrong with ad');
      }
      return res.status(500).send(err);
    }

    // set username and memberof in session
    req.session.username = result.displayName;

    if (ad.groupSearchBase === undefined) {
      // Find all locally-stored groups with this user as a member
      Group.find({ members: userid }, function(groupErr, groupResult) {
        if (groupErr) {
          req.session.memberOf = [];
          return;
        }

        const groups = [];
        result.forEach(function(g) {
          groups.push(g.id);
        });
        req.session.memberOf = groups;
      });
    } else if (result.memberOf) {
      if (result.memberOf instanceof Array) {
        req.session.memberOf = filterGroup(result.memberOf);
      } else {
        req.session.memberOf = [result.memberOf];
      }
    } else {
      req.session.memberOf = [];
    }

    // load others from db
    return User.findOne({
      _id: userid,
    }).exec(function(userErr, user) {
      if (userErr) {
        console.error(userErr.message);
        return res.status(500).send(userErr);
      }
      if (user) {
        req.session.roles = user.roles;
        // update user last visited on
        User.findByIdAndUpdate(
          user._id,
          {
            lastVisitedOn: Date.now(),
          },
          function(updateErr) {
            if (updateErr) {
              console.error(updateErr.message);
            }
          }
        );
      } else {
        // create a new user
        // TODO: need to load the user properties using ad.objAttributes
        let default_roles = [];
        if (auth.default_roles !== undefined) {
          default_roles = auth.default_roles;
        }
        req.session.roles = default_roles;

        const first = new User({
          _id: userid,
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
          // Try using user info to add a new group if needed.
          Group.findOne({
            name: result.memberOf,
          })
            .lean()
            .exec(function(groupErr, group) {
              if (groupErr) {
                console.error(groupErr.msg);
              } else if (group === undefined) {
                const newGroup = new Group({
                  _id: [result.memberOf],
                  name: result.memberOf,
                  forms: [],
                  travelers: [],
                });

                newGroup.save(function(saveErr, createdGroup) {
                  if (saveErr) {
                    console.error(saveErr.msg);
                  } else {
                    console.info(`A new group created: ${createdGroup.name}`);
                  }
                });
              }
            });
        }

        first.save(function(saveErr, newUser) {
          if (saveErr) {
            console.error(saveErr);
            console.error(newUser.toJSON());
            return res
              .status(500)
              .send('Cannot log in. Please contact the admin. Thanks.');
          }
          return console.info(`A new user created : ${newUser.name}`);
        });
      }
      return cb();
    });
  });
}

function sessionLocals(req, res, next) {
  res.locals = {
    session: req.session,
    prefix: req.proxied ? req.proxied_prefix : '',
  };
  next();
}

function checkAuth(req, res, next) {
  if (req.query.ticket) {
    ensureAuthenticated(req, res, next);
  } else {
    next();
  }
}

/**
 * check if the user has any of the roles
 * if true next
 * else reject
 *
 * @param  {...String} roles
 * @return Function|null
 */
function verifyRole(...roles) {
  return function(req, res, next) {
    if (roles.length === 0) {
      return next();
    }
    let i;
    if (req.session.roles) {
      for (i = 0; i < roles.length; i += 1) {
        if (req.session.roles.indexOf(roles[i]) > -1) {
          return next();
        }
      }
      res.status(403).send('You are not authorized to access this resource. ');
    }
    console.log('Cannot identify your roles.');
    return res.status(500).send('something wrong with your session');
  };
}

function requireRoles(condition, ...roles) {
  return function(req, res, next) {
    let pre = true;
    if (_.isFunction(condition)) {
      pre = condition(req, res);
    }
    if (!pre) {
      return next();
    }
    return verifyRole(...roles)(req, res, next);
  };
}

function basicAuthFail(res, message = undefined) {
  res.set('WWW-Authenticate', 'Basic realm="api"');
  if (message) {
    return res.status(401).send(message);
  }
  return res.status(401).send();
}

function basicAuth(req, res, next) {
  const cred = basic(req);

  // No credentials provided
  if (!cred) {
    return basicAuthFail(res);
  }

  if (apiUsers.hasOwnProperty(cred.name) && apiUsers[cred.name] === cred.pass) {
    // Verify system API account
    return next();
  }
  // Verify user API Key
  return User.findOne({
    _id: cred.name,
  }).exec(function(err, user) {
    if (err) {
      return basicAuthFail(res);
    }
    if (user.apiKey === cred.pass) {
      // Verify api permission
      if (user.roles.indexOf('api') === -1) {
        return basicAuthFail(res, "'api' permission required.");
      }
      // Verify api key expiration
      if (user.apiKeyExpiration < new Date()) {
        return basicAuthFail(
          res,
          'API key expired. Please navigate to profile and issue a new api key.'
        );
      }

      req.user = user;
      return next();
    }
    return basicAuthFail(res);
  });
}

module.exports = {
  ensureAuthenticated,
  verifyRole,
  requireRoles,
  checkAuth,
  sessionLocals,
  basicAuth,
  proxied,
};
