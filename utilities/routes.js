/**
 * Created by djarosz on 11/6/15.
 */
/**
 * The purpose of this file is to store all functions and utilities that are used by multiple routes.
 */

function filterBody(strings) {
    return function (req, res, next) {
        var k, found = false;
        for (k in req.body) {
            if (req.body.hasOwnProperty(k)) {
                if (strings.indexOf(k) !== -1) {
                    found = true;
                } else {
                    req.body[k] = null;
                }
            }
        }
        if (found) {
            next();
        } else {
            return res.send(400, 'cannot find required information in body');
        }
    };
}

function checkUserRole(req, role){
    if(req.session.roles != undefined && req.session.roles.indexOf(role) != -1) {
        return true;
    }
    else {
        return false;
    }
}

module.exports = {
    filterBody: filterBody,
    checkUserRole: checkUserRole
};