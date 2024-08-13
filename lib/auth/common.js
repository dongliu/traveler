const config = require('../../config/config.js');
const configPath = config.configPath;

const ad = config.ad;
const auth = config.auth;
const alias = config.alias;

const ldapLoginService = '/ldaplogin/';


function redirectService(res, req, destination) {
    if (req.proxied) {
        res.redirect(auth.proxied_service + destination);
    } else {
        res.redirect(auth.service + destination);
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

function getCurrentUser(userid, req, res, cb) {
    userid = userid.toLowerCase();
    // query ad about other attribute
    ldapClient.searchForUser(userid, function (err, result) {
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
            Group.find({ "members": userid }, function (err, result) {
                if (err) {
                    req.session.memberOf = [];
                    return;
                }

                let groups = [];
                result.forEach(function (g) {
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
        }).exec(function (err, user) {
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
                    function (err) {
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
                        .exec(function (err, group) {
                            if (err) {
                                console.error(err.msg);
                            } else if (group === undefined) {
                                var newGroup = new Group({
                                    _id: [result.memberOf],
                                    name: result.memberOf,
                                    forms: [],
                                    travelers: [],
                                });

                                newGroup.save(function (err, createdGroup) {
                                    if (err) {
                                        console.error(err.msg);
                                    } else {
                                        console.info('A new group created: ' + createdGroup.name);
                                    }
                                });
                            }
                        });
                }

                first.save(function (err, newUser) {
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

function authenticationSucceeded(username, req, res) {
    getCurrentUser(username, req, res, function () {
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
module.exports = { redirectToLoginService, ad, auth, alias, configPath, redirectService, authenticationSucceeded }