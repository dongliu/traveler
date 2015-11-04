var ldap = require('ldapjs');
var configPath = require('../config/config.js').configPath;

var ad = require('../' + configPath +'/ad.json');

var clientOptions = {
    url: ad.url,
    maxConnections: 5,
    connectTimeout: 10 * 1000,
    timeout: 15 * 1000,
    bindDN: ad.adminDn,
    bindCredentials: ad.adminPassword
};
if(ad.ldapsCA != undefined){
    var fs = require('fs');
    clientOptions['tlsOptions'] = {
        ca: fs.readFileSync(configPath + '/' + ad.ldapsCA)
    };
}

var client = ldap.createClient(clientOptions);

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
        result.on('error', function (err) {
            console.log(JSON.stringify(err));
            return cb(err);
        });
        result.on('end', function (result) {
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
}

function mapDefaultKeyNames(items, defaultKeys, cb){
    for (var key in defaultKeys){
        if (items[0][defaultKeys[key]] != undefined){
            items[0][key] = items[0][defaultKeys[key]];
        } else {
            items[0][key] = "";
        }
    }

    return cb(null, items);
}

module.exports = {
    client: client,
    search: search
};
