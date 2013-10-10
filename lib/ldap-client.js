var ldap = require('ldapjs');

var ad = require('../config/ad.json');

var client = ldap.createClient({
  url: ad.url,
  maxConnections: 2,
  timeout: 3000,
  bindDN: ad.adminDn,
  bindCredentials: ad.adminPassword
});

module.exports = {
  search: search
};

// function bind(cb) {
//   // if (ad.bind) {
//   //   return cb();
//   // }
//   client.bind(ad.adminDn, ad.adminPassword, function(err) {
//     if (err) {
//       console.log(err);
//       return cb(err);
//     }
//     return cb();
//   });
// }

function search(base, opts, raw, cb) {
  // bind(function(err) {
  //   if (err) {
  //     return cb(err);
  //   }
    client.search(base, opts, function(err, result) {
      if (err) {
        console.log(JSON.stringify(err));
        return cb(err);
      }
      var items = [];
      result.on('searchEntry', function(entry) {
        if (raw) {
          items.push(entry.raw);
        } else {
          items.push(entry.object);
        }
      });
      result.on('error', function(err) {
        console.log(JSON.stringify(err));
        return cb(err);
      });
      result.on('end', function(result) {
        if (result.status !== 0) {
          var err = 'non-zero status from LDAP search: ' + result.status;
          console.log(JSON.stringify(err));
          return cb(err);
        }
        switch (items.length) {
          case 0:
            return cb(null, []);
          default:
            return cb(null, items);
        }
      });
    });
  // });
}