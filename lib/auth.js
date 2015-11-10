// authentication and authorization functions
var url = require('url');
var mongoose = require('mongoose');
var pause = require('pause');
var ldapClient = require('../lib/ldap-client');

// Import configuration files
var config = require('../config/config.js')
var configPath = config.configPath;

var ad = config.ad;
var auth = config.auth;
var apiUsers = config.api.api_users;

// Create CAS client
var Client = null;
if (auth.type === 'cas') {
    Client = require('cas.js');
    // validation of ticket is with the lan, and therefore url does not need to be proxied.
    var cas = new Client({
        base_url: auth.cas,
        service: auth.login_service,
        version: 1.0
    });
} else if (auth.type === 'ldap') {
    var ldap = require('ldapjs');
    var ldapLoginService = "/ldaplogin/";
    var clientOptions = {
        url: ad.url,
        maxConnections: 5,
        connectTimeout: 10 * 1000,
        timeout: 15 * 1000
    };
    if (ad.ldapsCA != undefined) {
        var fs = require('fs');
        clientOptions['tlsOptions'] = {
            ca: fs.readFileSync(configPath + '/' + ad.ldapsCA)
        };
    }
    var localLdapClient = ldap.createClient(clientOptions);

}

var User = mongoose.model('User');
var Group = mongoose.model('Group');

function proxied(req, res, next) {
    if (req.get('x-forwarded-host') && req.get('x-forwarded-host') === auth.proxy) {
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
        }
    }
    return output;
}

function ensureAuthenticated(req, res, next) {
    if (auth.type === 'cas') {
        casEnsureAuthenticated(req, res, next);
    } else if (auth.type === 'ldap') {
        ldapEnsureAuthenticated(req, res, next);
    }
}

function ldapEnsureAuthenticated(req, res, next) {
    if (req.session.userid) {
        //logged in already
        next();
    } else if (req.originalUrl != ldapLoginService) {
        //Not on the login page currently so redirect user to login page
        redirectToLoginService(req, res);
    } else {
        //POST method once the user submits the login form.
        console.log("perform authentication");
        //Perform authentication
        var username = req.body.username;
        var password = req.body.password;

        var baseDN = ad.searchBase;
        bindDN = 'uid=' + username + ',' + baseDN;

        localLdapClient.bind(bindDN, password, function (err) {
            if (err === null) {
                authenticationSucceeded();
            } else {
                var error = '';
                //Do not notify the user if the username is valid
                if (err.name === "NoSuchObjectError" || err.name === "InvalidCredentialsError"){
                    error = "Invalid username or password was provided."
                } else {
                    error = err.name;
                }
                res.locals.error = error;
                next();
            }
        });
        password = undefined;

        function authenticationSucceeded() {
            var searchFilter = ad.searchFilter.replace('_id', username);

            var opts = {
                filter: searchFilter,
                attributes: ad.objAttributes,
                scope: 'sub'
            };

            getCurrentUser(opts, baseDN, req, res, username, function () {
                req.session.userid = username;
                if (req.session.landing == undefined) {
                    redirectService(res, req, '/');
                } else {
                    redirectService(res, req, req.session.landing);
                    req.session.landing = undefined;
                }
            });
        }
    }
}

function casEnsureAuthenticated(req, res, next) {
    // console.log(req.session);
    var ticketUrl = url.parse(req.url, true);
    if (req.session.userid) {
        // logged in already
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
        // just kicked back by CAS
        // var halt = pause(req);
        if (req.proxied) {
            cas.service = auth.login_proxied_service;
        } else {
            cas.service = auth.login_service;
        }

        cas_hostname = cas.hostname.split(":");
        if (cas_hostname.length == 2) {
            cas.hostname = cas_hostname[0];
            cas.port = cas_hostname[1];
        }

        // validate the ticket
        cas.validate(req.query.ticket, function (err, casresponse, result) {
            if (err) {
                console.error(err.message);
                return res.send(401, err.message);
            }
            if (result.validated) {
                var userid = result.username;
                // set userid in session
                req.session.userid = userid;
                var searchFilter = ad.searchFilter.replace('_id', userid);
                var opts = {
                    filter: searchFilter,
                    attributes: ad.objAttributes,
                    scope: 'sub'
                };

                getCurrentUser(opts, ad.searchBase, req, res, userid, function () {
                    if (req.session.landing && req.session.landing !== '/login') {
                        res.redirect(req.proxied ? url.resolve(auth.proxied_service + '/', '.' + req.session.landing) : req.session.landing);
                    } else {
                        // has a ticket but not landed before, must copy the ticket from somewhere ...
                        res.redirect(req.proxied ? auth.proxied_service : '/');
                    }
                    // halt.resume();
                });
            } else {
                console.error('CAS reject this ticket');
                return res.redirect(req.proxied ? auth.login_proxied_service : auth.login_service);
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
            res.set('WWW-Authenticate', 'CAS realm="' + (req.proxied ? auth.proxied_service : auth.service) + '"');
            res.send(401, 'xhr cannot be authenticated');
        } else {
            // set the landing, the first unauthenticated url
            req.session.landing = req.url;
            if (req.proxied) {
                res.redirect(auth.proxied_cas + '/login?service=' + encodeURIComponent(auth.login_proxied_service));
            } else {
                res.redirect(auth.cas + '/login?service=' + encodeURIComponent(auth.login_service));
            }
        }
    } else if (auth.type === 'ldap') {
        //ldap
        if (req.xhr) {
            res.send(401, 'xhr cannot be authenticated');
        } else {
            redirectService(res, req, ldapLoginService);
            req.session.landing = req.originalUrl;
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

function getCurrentUser(opts, searchBase, req, res, userid, cb) {
    // query ad about other attribute
    ldapClient.search(searchBase, opts, false, function (err, result) {
        if (err) {
            console.error(err.name + ' : ' + err.message);
            return res.send(500, 'something wrong with ad');
        }
        if (result.length === 0) {
            console.warn('cannot find ' + userid);
            return res.send(500, userid + ' is not found!');
        }
        if (result.length > 1) {
            return res.send(500, userid + ' is not unique!');
        }

        // set username and memberof in session
        req.session.username = result[0].displayName;
        if (result[0].memberof instanceof Array) {
            req.session.memberOf = filterGroup(result[0].memberOf);
        } else {
            req.session.memberOf = [result[0].memberOf];
        }

        // load others from db
        User.findOne({
            _id: userid
        }).lean().exec(function (err, user) {
            if (err) {
                console.error(err.msg);
            }
            if (user) {
                req.session.roles = user.roles;
                // update user last visited on
                User.findByIdAndUpdate(user._id, {
                    lastVisitedOn: Date.now()
                }, function (err, update) {
                    if (err) {
                        console.error(err.message);
                    }
                });
            } else {
                // create a new user
                var default_roles = [];
                if(auth.default_roles != undefined){
                    default_roles = auth.default_roles;
                }
                req.session.roles = default_roles;

                var first = new User({
                    _id: userid,
                    name: result[0].displayName,
                    email: result[0].mail,
                    office: result[0].physicalDeliveryOfficeName,
                    phone: result[0].telephoneNumber,
                    mobile: result[0].mobile,
                    roles: default_roles,
                    lastVisitedOn: Date.now()
                });

                // Check if current group exists
                if (ad.groupSearchBase == undefined) {
                    //Try using user info to add a new group if needed.
                    Group.findOne({
                        name: result[0].memberOf
                    }).lean().exec(function (err, group) {
                        if (err) {
                            console.error(err.msg);
                        }
                        else if (group == undefined) {
                            var newGroup = new Group({
                                _id: [
                                    result[0].memberOf
                                ],
                                name: result[0].memberOf,
                                forms: [],
                                travelers: []
                            });

                            newGroup.save(function(err, createdGroup){
                                if (err) {
                                   console.error(err.msg);
                                }else {
                                    console.info('A new group created: ' + createdGroup.name);
                                }
                            });
                        }
                    });
                }

                first.save(function (err, newUser) {
                    if (err) {
                        console.error(err.msg);
                    }
                    console.info('A new user created : ' + newUser.name);
                });
            }
            cb();
        });
    });
}

function sessionLocals(req, res, next) {
    res.locals({
        session: req.session,
        prefix: req.proxied ? req.proxied_prefix : ''
    });
    next();
}


function checkAuth(req, res, next) {
    if (req.query.ticket) {
        ensureAuthenticated(req, res, next);
    } else {
        next();
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
    checkAuth: checkAuth,
    sessionLocals: sessionLocals,
    basicAuth: basicAuth,
    proxied: proxied
};
