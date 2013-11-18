// authentication and authorization functions
var Client = require('cas.js');
var url = require('url');
var ad = require('../config/ad.json');

var ldapClient = require('../lib/ldap-client');

var mongoose = require('mongoose');
var User = mongoose.model('User');

var cas = new Client({
  base_url: 'https://liud-dev.nscl.msu.edu/cas',
  service: 'http://localhost:3001',
  version: 1.0
});

module.exports = {
  ensureAuthenticated: ensureAuthenticated,
  verifyRole: verifyRole
};

function ensureAuthenticated(req, res, next) {
  var ticketUrl = url.parse(req.url, true);
  if (req.session.userid) {
    // console.log(req.session);
    if (req.query.ticket) {
      // remove the ticket query param
      delete ticketUrl.query.ticket;
      return res.redirect(301, url.format({
        pathname: ticketUrl.pathname,
        query: ticketUrl.query
      }));
    } else {
      return next();
    }
  } else if (req.query.ticket) {
    cas.validate(req.query.ticket, function(err, status, userid) {
      if (err) {
        console.error(err.message);
        return res.send(401, err.message);
      } else {
        if (status) {
          req.session.userid = userid;
          User.findOne({
            id: userid
          }).lean().exec(function(err, user) {
            if (err) {
              console.error(err.msg);
              // still let it go without create the user?
              req.session.roles = [];
              req.session.username = 'unknown';
              return next();
            } else {
              if (user) {
                req.session.roles = user.roles;
                req.session.username = user.name;
                User.findByIdAndUpdate(user._id, {
                  lastVisitedOn: Date.now()
                }).lean().exec(function(err, update) {
                  if (err) {
                    console.err(err.message);
                  }
                });
                if (req.session.landing) {
                  return res.redirect(req.session.landing);
                } else {
                  return next();
                }
              } else {
                // create a new user
                var searchFilter = ad.searchFilter.replace('_id', userid);
                var opts = {
                  filter: searchFilter,
                  attributes: ad.objAttributes,
                  scope: 'sub'
                };
                ldapClient.search(ad.searchBase, opts, false, function(err, result) {
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
                    id: userid,
                    name: result[0].displayName,
                    email: result[0].mail,
                    office: result[0].physicalDeliveryOfficeName,
                    phone: result[0].telephoneNumber,
                    mobile: result[0].mobile,
                    roles: [],
                    lastVisitedOn: Date.now()
                  });

                  first.save(function(err, newUser) {
                    if (err) {
                      console.err(err.msg);
                    }
                    req.session.roles = [];
                    console.info('A new user logs in: ' + newUser.name);
                    req.session.username = newUser.name;
                    return next();
                  });

                });

              }
            }
          });
        } else {
          console.error('CAS reject this ticket');
          return res.redirect(cas.service);
        }

      }
    });
  } else {
    // if this is ajax call, then force the browser to refresh to the current page
    if (req.xhr) {
      res.set('WWW-Authenticate', 'CAS realm="' + url.format({protocol: 'http', hostname: ticketUrl.hostname}) + '"');
      return res.send(401, 'xhr cannot be authenticated');
    } else {
      req.session.landing = req.url;
      return res.redirect('https://' + cas.hostname + cas.base_path + '/login?service=' + encodeURIComponent(cas.service));
    }
  }
}

function verifyRole(role) {
  return function(req, res, next) {
    // console.log(req.session);
    if (req.session.roles) {
      if (req.session.roles.indexOf(role) > -1) {
        return next();
      } else {
        return res.send(403, "You are not authorized to access this resource. ");
      }
    } else {
      console.log("Cannot find the user's role.");
      return res.send(500, "something wrong for the user's session");
    }
  };
}