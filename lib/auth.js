// authentication and authorization functions
var Client = require('cas.js');
var url = require('url');
var ad = require('../config/ad.json');
var auth = require('../config/auth.json');
var pause = require('pause');

var apiUsers = require('../config/api.json');

var ldapClient = require('../lib/ldap-client');

var mongoose = require('mongoose');
var User = mongoose.model('User');

// validation of ticket is with the lan, and therefore url does not need to be proxied.
var cas = new Client({
  base_url: auth.cas,
  service: auth.service,
  version: 1.0
});

function proxied(req, res, next) {
  if (req.get('x-forwarded-host') && req.get('x-forwarded-host') === auth.proxy) {
    req.proxied = true;
    req.proxied_prefix = url.parse(auth.proxied_service).pathname;
  }
  next();
}

function ensureAuthenticated(req, res, next) {
  console.log(req.headers);
  var ticketUrl = url.parse(req.url, true);
  if (req.session.userid) {
    // console.log(req.session);
    if (req.query.ticket) {
      // remove the ticket query param
      delete ticketUrl.query.ticket;
      return res.redirect(301, url.format({
        pathname: req.proxied ? url.resolve(auth.proxied_service + '/', '.' + ticketUrl.pathname) : ticketUrl.pathname,
        query: ticketUrl.query
      }));
    }
    next();
  } else if (req.query.ticket) {
    var halt = pause(req);

    if (req.proxied) {
      cas.service = auth.proxied_service;
    } else {
      cas.service = auth.service;
    }
    // validate directly at cas.base_url
    cas.validate(req.query.ticket, function (err, status, userid) {
      if (err) {
        console.error(err.message);
        res.send(401, err.message);
      } else {
        if (status) {
          req.session.userid = userid;
          User.findOne({
            _id: userid
          }).lean().exec(function (err, user) {
            if (err) {
              console.error(err.msg);
              return res.send(500, 'internal error with db');
            }
            if (user) {
              req.session.roles = user.roles;
              req.session.username = user.name;
              User.findByIdAndUpdate(user._id, {
                lastVisitedOn: Date.now()
              }, function (err, update) {
                if (err) {
                  console.err(err.message);
                  return res.send(500, 'internal error with db');
                }
              });
              if (req.session.landing && req.session.landing !== '/') {
                return res.redirect(req.proxied ? url.resolve(auth.proxied_service + '/', '.' + req.session.landing) : req.session.landing);
              }
              next();
              halt.resume();
            } else {
              // create a new user
              var searchFilter = ad.searchFilter.replace('_id', userid);
              var opts = {
                filter: searchFilter,
                attributes: ad.objAttributes,
                scope: 'sub'
              };
              ldapClient.search(ad.searchBase, opts, false, function (err, result) {
                if (err) {
                  console.err(err.name + ' : ' + err.message);
                  return res.send(500, 'something wrong with ad');
                }
                if (result.length === 0) {
                  console.warn('cannot find ' + userid);
                  return res.send(500, userid + ' is not found!');
                }
                if (result.length > 1) {
                  return res.send(500, userid + ' is not unique!');
                }

                var first = new User({
                  _id: userid,
                  name: result[0].displayName,
                  email: result[0].mail,
                  office: result[0].physicalDeliveryOfficeName,
                  phone: result[0].telephoneNumber,
                  mobile: result[0].mobile,
                  roles: [],
                  lastVisitedOn: Date.now()
                });

                first.save(function (err, newUser) {
                  if (err) {
                    console.err(err.msg);
                    return res.send(500, 'internal error with db');
                  }
                  req.session.roles = [];
                  console.info('A new user logs in: ' + newUser.name);
                  req.session.username = newUser.name;
                  next();
                  halt.resume();
                });
              });
            }
          });
        } else {
          console.error('CAS reject this ticket');
          return res.redirect(req.proxied ? auth.proxied_service : auth.service);
        }
      }
    });
  } else {
    // if this is ajax call, then kick back without redirect
    if (req.xhr) {
      // TODO: might need to properly set the WWW-Authenticate header
      res.set('WWW-Authenticate', 'CAS realm="' + (req.proxied ? auth.proxied_service : auth.service) + '"');
      res.send(401, 'xhr cannot be authenticated');
    } else {
      req.session.landing = req.url;
      if (req.proxied) {
        res.redirect(auth.proxied_cas + '/login?service=' + encodeURIComponent(auth.proxied_service));
      } else {
        res.redirect(auth.cas + '/login?service=' + encodeURIComponent(auth.service));
      }
    }
  }
}

function verifyRole(role) {
  return function (req, res, next) {
    // console.log(req.session);
    if (req.session.roles) {
      if (req.session.roles.indexOf(role) > -1) {
        next();
      } else {
        res.send(403, "You are not authorized to access this resource. ");
      }
    } else {
      console.log("Cannot find the user's role.");
      res.send(500, "something wrong for the user's session");
    }
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
    return res.send(401);
  }
  next();
}

module.exports = {
  ensureAuthenticated: ensureAuthenticated,
  verifyRole: verifyRole,
  basicAuth: basicAuth,
  proxied: proxied
};
