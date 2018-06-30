var ldap = require('ldapjs');
var config = require('../config/config.js');
var configPath = config.configPath;
var fs = require('fs');
var ad = config.ad;
var auth = config.auth;

var searchClientOptions = {
  url: ad.url,
  maxConnections: 5,
  connectTimeout: 10 * 1000,
  timeout: 15 * 1000
};

if (ad.adminDn && ad.adminPassword) {
  searchClientOptions.bindDN = ad.adminDn;
  searchClientOptions.bindCredentials = ad.adminPassword;
}


if (ad.ldapsCA) {
  searchClientOptions.tlsOptions = {
    ca: fs.readFileSync(configPath + '/' + ad.ldapsCA)
  };
}

var searchClient;
var bindClient;

var bindClientOptions = {
  url: ad.url,
  maxConnections: 5,
  connectTimeout: 10 * 1000,
  timeout: 15 * 1000
};

if (ad.ldapsCA) {
  bindClientOptions.tlsOptions = {
    ca: fs.readFileSync(configPath + '/' + ad.ldapsCA)
  };
}

if (!ad.singleConnection) {
  searchClient = ldap.createClient(searchClientOptions);
  if (auth.type === 'ldap') {
    bindClient = ldap.createClient(bindClientOptions);
  }
}

var bind = null;

if (auth.type === 'ldap') {
  bind = function (bindDN, password, cb) {
    if (ad.singleConnection) {
      if (bindClient) {
        bindClient.destroy();
        bindClient = undefined;
      }
      bindClient = ldap.createClient(bindClientOptions);
    }
    bindClient.bind(bindDN, password, function (err) {
      return cb(err);
    });
  };
}

function mapDefaultKeyNames(items, defaultKeys, cb) {
  for (var key in defaultKeys) {
    if (items[0][defaultKeys[key]] !== undefined) {
      items[0][key] = items[0][defaultKeys[key]];
    } else {
      items[0][key] = '';
    }
  }
  return cb(null, items);
}

function _search(base, opts, raw, cb) {
  searchClient.search(base, opts, function (err, result) {
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
    result.on('error', function (resultErr) {
      console.log(JSON.stringify(resultErr));
      return cb(resultErr);
    });
    result.on('end', function (end) {
      if (end.status !== 0) {
        var error = 'non-zero status from LDAP search: ' + end.status;
        console.log(error);
        return cb(err);
      }
      switch (items.length) {
      case 0:
        return cb(null, []);
      default:
        return mapDefaultKeyNames(items, ad.defaultKeys, cb);
      }
    });
  });
}

function search(base, opts, raw, cb) {
  if (ad.singleConnection) {
    if (searchClient) {
      searchClient.destroy();
      searchClient = undefined;
    }
    searchClient = ldap.createClient(searchClientOptions);
  }
  return _search(base, opts, raw, cb);
}

module.exports = {
  search: search,
  bind: bind
};
