var ldap = require('ldapjs');

var ad = require('../config/ad.json');

var client = ldap.createClient({
  url: ad.url,
  paging: true,
  timeout: 15 * 1000,
  reconnect: true,
  bindDN: ad.adminDn,
  bindCredentials: ad.adminPassword
});

function search(base, opts, raw, cb) {
  client.search(base, opts, function (err, result) {
    if (err) {
      console.log(JSON.stringify(err));
      return cb(err);
    }
    var items = [];
    result.on('searchEntry', function (entry) {
      if (raw) {
        items.push(entry.raw);
      } else {
        items.push(entry.object);
      }
    });
    result.on('error', function (e) {
      console.log(JSON.stringify(e));
      return cb(e);
    });
    result.on('end', function (r) {
      if (r.status !== 0) {
        var e = 'non-zero status from LDAP search: ' + result.status;
        console.log(JSON.stringify(e));
        return cb(e);
      }
      switch (items.length) {
      case 0:
        return cb(null, []);
      default:
        return cb(null, items);
      }
    });
  });
}

module.exports = {
  client: client,
  search: search
};
