// authentication and authorization functions
var url = require('url');
var mongoose = require('mongoose');
var ldapClient = require('../lib/ldap-client');
var _ = require('lodash');

const debug = require('debug')('traveler:auth');
const util = require('util');

// Import configuration files
var config = require('../config/config.js');
var configPath = config.configPath;

var ad = config.ad;
var auth = config.auth;
var alias = config.alias;

var apiUsers = config.api.api_users;

// Create CAS client
var Client = null;
if (auth.type === 'cas') {
  Client = require('cas.js');
  // validation of ticket is with the lan, and therefore url does not need to be proxied.
  var cas = new Client({
    base_url: auth.cas,
    service: auth.login_service,
    version: 1.0,
  });
} else if (auth.type === 'ldap' || auth.type === 'ldapWithDnLookup') {
  var ldapLoginService = '/ldaplogin/';
  var ldapLookup = auth.type === 'ldapWithDnLookup';
  var clientOptions = {
    url: ad.url,
    maxConnections: 5,
    connectTimeout: 10 * 1000,
    timeout: 15 * 1000,
  };
  if (ad.ldapsCA !== undefined) {
    var fs = require('fs');
    clientOptions.tlsOptions = {
      ca: fs.readFileSync(configPath + '/' + ad.ldapsCA),
      rejectUnauthorized: ad.ldapsRejectUnauthorized,
    };
  }
}

var User = mongoose.model('User');
var Group = mongoose.model('Group');

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
  var first = s.split(',', 1)[0];
  return first.substr(3).toLowerCase();
}

function filterGroup(a) {
  var output = [];
  var i;
  var group;
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
  } else if (auth.type.startsWith('ldap')) {
    return ldapEnsureAuthenticated(req, res, next);
  }
}

function ldapEnsureAuthenticated(req, res, next) {
  if (req.session.userid) {
    //logged in already
    debug('user already logged in');
    return next();
  } else if (req.originalUrl !== ldapLoginService) {
    //Not on the login page currently so redirect user to login page
    return redirectToLoginService(req, res);
  } else {
    //POST method once the user submits the login form.
    console.log('perform authentication');
    //Perform authentication
    var username = req.body.username;
    var password = req.body.password;

    var baseDN = ad.searchBase;
    if (ldapLookup) {
      ldapClient.searchForUser(username, function(err, ldapUser) {
        if (err !== null) {
          console.log(err.message);
          res.locals.error = 'Invalid username or password was provided.';
          return next();
        } else {
          return authenticateUsingLdap(
            ldapUser.dn,
            username,
            password,
            req,
            res,
            next
          );
        }
      });
    } else {
      var bindDN = 'uid=' + username + ',' + baseDN;
      return authenticateUsingLdap(bindDN, username, password, req, res, next);
    }
  }
}

function authenticateUsingLdap(bindDN, username, password, req, res, next) {
  ldapClient.getClient(clientOptions, function(localLdapClient, cleanUp) {
    localLdapClient.bind(bindDN, password, function(err) {
      cleanUp();
      if (err === null) {
        authenticationSucceeded(username, req, res);
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

function authenticationSucceeded(username, req, res) {
  getCurrentUser(username, req, res, function() {
    req.session.userid = username;
    if (req.session.landing === undefined) {
      redirectService(res, req, '/');
    } else {
      var landing = req.session.landing;
      req.session.landing = undefined;
      redirectService(res, req, landing);
    }
  });
}

function casEnsureAuthenticated(req, res, next) {
  // console.log(req.session);
  var ticketUrl = url.parse(req.url, true);
  if (req.session.userid) {
    // logged in already
    if (req.query.ticket) {
      // remove the ticket query param
      delete ticketUrl.query.ticket;
      return res.redirect(
        301,
        url.format({
          pathname: req.proxied
            ? url.resolve(auth.proxied_service + '/', '.' + ticketUrl.pathname)
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

    var cas_hostname = cas.hostname.split(':');
    if (cas_hostname.length === 2) {
      cas.hostname = cas_hostname[0];
      cas.port = cas_hostname[1];
    }

    // validate the ticket
    cas.validate(req.query.ticket, function(err, casresponse, result) {
      if (err) {
        console.error(err.message);
        return res.status(401).send(err.message);
      }
      if (result.validated) {
        var userid = result.username;
        // set userid in session
        req.session.userid = userid;

        getCurrentUser(userid, req, res, function() {
          if (req.session.landing && req.session.landing !== '/login') {
            res.redirect(
              req.proxied
                ? url.resolve(
                    auth.proxied_service + '/',
                    '.' + req.session.landing
                  )
                : req.session.landing
            );
          } else {
            // has a ticket but not landed before, must copy the ticket from somewhere ...
            res.redirect(req.proxied ? auth.proxied_service : '/');
          }
          // halt.resume();
        });
      } else {
        console.error('CAS reject this ticket');
        return res.redirect(
          req.proxied ? auth.login_proxied_service : auth.login_service
        );
      }
    });
  } else {
    redirectToLoginService(req, res);
  }
}

function redirectToLoginService(req, res) {
  if (auth.type === 'cas') {
    // if this is ajax call, then send 401 without redirect
    if (req.xhr) {
      // TODO: might need to properly set the WWW-Authenticate header
      res.set(
        'WWW-Authenticate',
        'CAS realm="' +
          (req.proxied ? auth.proxied_service : auth.service) +
          '"'
      );
      res.status(401).send('xhr cannot be authenticated');
    } else {
      // set the landing, the first unauthenticated url
      req.session.landing = req.url;
      if (req.proxied) {
        res.redirect(
          auth.proxied_cas +
            '/login?service=' +
            encodeURIComponent(auth.login_proxied_service)
        );
      } else {
        res.redirect(
          auth.cas + '/login?service=' + encodeURIComponent(auth.login_service)
        );
      }
    }
  } else if (auth.type.startsWith('ldap')) {
    //ldap
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
  // query ad about other attribute
  ldapClient.searchForUser(userid, function(err, result) {
    if (err) {
      if (err instanceof Error) {
        console.error(err.name + ' : ' + err.message);
        return res.status(500).send('something wrong with ad');
      } else {
        return res.status(500).send(err);
      }
    }

    // set username and memberof in session
    req.session.username = result.displayName;

    if (ad.groupSearchBase === undefined) {
      // Find all locally-stored groups with this user as a member
      Group.find({"members": userid}, function(err, result) {
        if (err) {
          req.session.memberOf = [];
          return;
        }

        let groups = [];
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
    User.findOne({
      _id: userid,
    }).exec(function(err, user) {
      if (err) {
        console.error(err.message);
      }
      if (user) {
        req.session.roles = user.roles;
        // update user last visited on
        User.findByIdAndUpdate(
          user._id,
          {
            lastVisitedOn: Date.now(),
          },
          function(err) {
            if (err) {
              console.error(err.message);
            }
          }
        );
      } else {
        // create a new user
        // TODO: need to load the user properties using ad.objAttributes
        var default_roles = [];
        if (auth.default_roles !== undefined) {
          default_roles = auth.default_roles;
        }
        req.session.roles = default_roles;

        var first = new User({
          _id: userid,
          name: result.displayName,
          email: result.mail,
          office: result.physicalDeliveryOfficeName,
          phone: result.telephoneNumber,
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
                    console.info('A new group created: ' + createdGroup.name);
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
        });
      }
      cb();
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
    var i;
    if (req.session.roles) {
      for (i = 0; i < roles.length; i += 1) {
        if (req.session.roles.indexOf(roles[i]) > -1) {
          return next();
        }
      }
      res.status(403).send('You are not authorized to access this resource. ');
    } else {
      console.log('Cannot identify your roles.');
      res.status(500).send('something wrong with your session');
    }
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

var basic = require('basic-auth');

function notKnown(cred) {
  if (apiUsers.hasOwnProperty(cred.name)) {
    if (apiUsers[cred.name] === cred.pass) {
      return false;
    }
  }
  return true;
}

function basicAuth(req, res, next) {
  var cred = basic(req);
  if (!cred || notKnown(cred)) {
    res.set('WWW-Authenticate', 'Basic realm="api"');
    return res.status(401).send();
  }
  next();
}

module.exports = {
  ensureAuthenticated: ensureAuthenticated,
  verifyRole: verifyRole,
  requireRoles: requireRoles,
  checkAuth: checkAuth,
  sessionLocals: sessionLocals,
  basicAuth: basicAuth,
  proxied: proxied,
};
