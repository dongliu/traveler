const basic = require('basic-auth');

const config = require('../../config/config.js');
const apiUsers = config.api.api_users;

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
  next()
}

module.exports = {basicAuth}