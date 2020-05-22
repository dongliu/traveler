var ldap = require('ldapjs');
var config = require('../config/config.js');
var configPath = config.configPath;

var ad = config.ad;

var clientOptions = {
  url: ad.url,
  maxConnections: 5,
  connectTimeout: 10 * 1000,
  timeout: 15 * 1000,
  bindDN: ad.adminDn,
  bindCredentials: ad.adminPassword,
};
if (ad.ldapsCA !== undefined) {
  var fs = require('fs');
  clientOptions.tlsOptions = {
    ca: fs.readFileSync(configPath + '/' + ad.ldapsCA),
    rejectUnauthorized: ad.ldapsRejectUnauthorized,
  };
}

function getDefaultClient(cb) {
  getClient(clientOptions, cb);
}

function getClient(clientOpts, cb) {
  var client = ldap.createClient(clientOpts);
  client.on('connect', function() {
    cb(client, function cleanUp() {
      client.unbind();
      client.destroy();
    });
  });
  client.on('timeout', function(message) {
    console.error(message);
  });
  client.on('error', function(error) {
    console.error(error);
  });
}

function searchForUser(username, cb) {
  var searchFilter = ad.searchFilter.replace('_id', username);
  var opts = {
    filter: searchFilter,
    scope: 'sub',
  };

  getDefaultClient(function(client, cleanUp) {
    client.search(ad.searchBase, opts, function(err, result) {
      if (err) {
        return cb(err);
      }
      var results = [];

      result.on('searchEntry', function(entry) {
        results.push(entry.object);
      });
      result.on('error', function(err) {
        console.log(JSON.stringify(err));
        cleanUp();
        return cb(err);
      });
      result.on('end', function(result) {
        cleanUp();
        switch (results.length) {
          case 0:
            cb('No result for specified username: ' + username);
            break;
          case 1:
            mapDefaultKeyNames(results, ad.defaultKeys, function(err, items) {
              cb(null, items[0]);
            });
            break;
          default:
            cb('Non unique for specified username: ' + username);
            break;
        }
      });
    });
  });
}

function search(base, opts, raw, cb) {
  getDefaultClient(function(client, cleanUp) {
    client.search(base, opts, function(err, result) {
      if (err) {
        console.log(JSON.stringify(err));
        cleanUp();
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
        cleanUp();
        return cb(err);
      });
      result.on('end', function(result) {
        cleanUp();
        if (result.status !== 0) {
          var err = 'non-zero status from LDAP search: ' + result.status;
          console.log(JSON.stringify(err));
          return cb(err);
        }
        switch (items.length) {
          case 0:
            return cb(null, []);
          default:
            mapDefaultKeyNames(items, ad.defaultKeys, cb);
        }
      });
    });
  });
}

function mapDefaultKeyNames(items, defaultKeys, cb) {
  for (var idx in items) {
    var item = items[idx];
    for (var key in defaultKeys) {
      if (item[defaultKeys[key]] !== undefined) {
        item[key] = item[defaultKeys[key]];
      } else {
        item[key] = '';
      }
    }
  }

  return cb(null, items);
}

module.exports = {
  getDefaultClient: getDefaultClient,
  getClient: getClient,
  search: search,
  searchForUser: searchForUser,
};
