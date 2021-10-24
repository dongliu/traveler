const ldap = require('ldapjs');
const fs = require('fs');
const util = require('util');
const debug = require('debug')('traveler:ldap-client');
const config = require('../config/config');
const logger = require('./loggers').getLogger();

const { configPath } = config;

const { ad } = config;

const clientOptions = {
  url: ad.url,
  maxConnections: 5,
  connectTimeout: 10 * 1000,
  timeout: 15 * 1000,
  bindDN: ad.adminDn,
  bindCredentials: ad.adminPassword,
};
if (ad.ldapsCA !== undefined) {
  clientOptions.tlsOptions = {
    ca: fs.readFileSync(`${configPath}/${ad.ldapsCA}`),
    rejectUnauthorized: ad.ldapsRejectUnauthorized,
  };
}

function getDefaultClient(cb) {
  getClient(clientOptions, cb);
}

function getClient(clientOpts, cb) {
  const client = ldap.createClient(clientOpts);
  client.on('connect', function() {
    cb(client, function cleanUp() {
      client.unbind();
      client.destroy();
    });
  });
  client.on('timeout', function(message) {
    logger.error(message);
  });
  client.on('error', function(error) {
    logger.error(error);
  });
}

function searchForUser(username, cb) {
  const searchFilter = ad.searchFilter.replace('_id', username);
  const opts = {
    filter: searchFilter,
    scope: 'sub',
  };

  getDefaultClient(function(client, cleanUp) {
    client.search(ad.searchBase, opts, function(err, result) {
      if (err) {
        return cb(err);
      }
      const results = [];

      result.on('searchEntry', function(entry) {
        results.push(entry.object);
      });
      result.on('error', function(error) {
        logger.error(JSON.stringify(error));
        cleanUp();
        return cb(error);
      });
      result.on('end', function() {
        cleanUp();
        switch (results.length) {
          case 0:
            cb(`No result for specified username: ${username}`);
            break;
          case 1:
            mapDefaultKeyNames(results, ad.defaultKeys, function(error, items) {
              cb(null, items[0]);
            });
            break;
          default:
            cb(`Non unique for specified username: ${username}`);
            break;
        }
      });
      return null;
    });
  });
}

function search(base, opts, raw, cb) {
  getDefaultClient(function(client, cleanUp) {
    client.search(base, opts, function(err, result) {
      if (err) {
        logger.error(JSON.stringify(err));
        cleanUp();
        return cb(err);
      }
      const items = [];
      result.on('searchEntry', function(entry) {
        if (raw) {
          items.push(entry.raw);
        } else {
          items.push(entry.object);
        }
      });
      result.on('error', function(error) {
        logger.error(JSON.stringify(error));
        cleanUp();
        return cb(error);
      });
      result.on('end', function(r) {
        cleanUp();
        if (r.status !== 0) {
          const error = `non-zero status from LDAP search: ${r.status}`;
          logger.error(JSON.stringify(error));
          return cb(error);
        }
        switch (items.length) {
          case 0:
            return cb(null, []);
          default:
            mapDefaultKeyNames(items, ad.defaultKeys, cb);
        }
        return null;
      });
      return null;
    });
  });
}

function mapDefaultKeyNames(items, defaultItems, cb) {
  debug(`before map: ${util.inspect(items)}`);
  const itemKeys = Object.keys(items);
  const defaultKeys = Object.keys(defaultItems);
  itemKeys.forEach(itemKey => {
    const item = items[itemKey];
    defaultKeys.forEach(defaultKey => {
      if (item[defaultItems[defaultKey]] !== undefined) {
        item[defaultKey] = item[defaultItems[defaultKey]];
      } else {
        item[defaultKey] = '';
      }
    });
  });
  debug(`after map: ${util.inspect(items)}`);
  return cb(null, items);
}

module.exports = {
  getDefaultClient,
  getClient,
  search,
  searchForUser,
};
