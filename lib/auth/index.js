const url = require('url');
var _ = require('lodash');
const util = require('util');
const debug = require('debug')('traveler:auth');

const ldap = require("./ldap.js");
const cas = require("./cas");
const basic = require("./basic");
const config = require('../../config/config.js');


var auth = config.auth;

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
    return function (req, res, next) {
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
    return function (req, res, next) {
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

function ensureAuthenticated(req, res, next) {
    debug(util.inspect(req.session));
    if (auth.type === 'cas') {
        return cas.ensureAuthenticated(req, res, next);
    } else if (auth.type.startsWith('ldap')) {
        return ldap.ensureAuthenticated(req, res, next);
    }
}

module.exports = {
    ensureAuthenticated,
    verifyRole,
    requireRoles,
    checkAuth,
    sessionLocals,
    basicAuth: basic.basicAuth,
    proxied
}