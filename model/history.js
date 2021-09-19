var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Mixed = Schema.Types.Mixed;
var ObjectId = Schema.Types.ObjectId;
var assert = require('assert');

var debug = require('debug')('traveler:history');
var _ = require('lodash');

const VERSION_KEY = '_v';

/**********
 * p: the property/path of an object
 * v: the change-to value of the property
 **********/
var change = new Schema({
  p: {
    type: String,
    required: true,
  },
  v: {
    type: Mixed,
  },
});

/**********
 * a: at, the date of the history
 * b: by, the author of the history
 * t: type, the object's type
 * i: id, the object's id
 * c: the array of changes
 **********/
var history = new Schema({
  a: {
    type: Date,
    required: true,
    default: Date.now(),
  },
  b: {
    type: String,
    required: true,
  },
  t: {
    type: String,
    required: true,
  },
  i: {
    type: ObjectId,
    refPath: 't',
    required: true,
  },
  c: [change],
});

var History = mongoose.model('History', history);

function addVersion(schema, options) {
  options = options || {};
  if (options.versionAll === true) {
    options.fieldsToVersion = Object.keys(schema.paths);
  }
  options.fieldsToVersion = _.chain([])
    .concat(options.fieldsToVersion)
    .filter(function(field) {
      return schema.path(field);
    })
    .reject(function(field) {
      return _.includes(['__updates', '_id', '__v'], field);
    })
    .value();

  schema.add({
    _v: { type: Number, default: 0 },
  });

  schema.methods.incrementVersion = function() {
    let doc = this;
    let version = doc.get(VERSION_KEY) || 0;
    debug(options.fieldsToVersion);
    options.fieldsToVersion.forEach(function(field) {
      debug(field + ' is modified ' + doc.isModified(field));
      if ((doc.isNew && doc.get(field)) || doc.isModified(field)) {
        doc.set(VERSION_KEY, version + 1);
        return;
      }
    });
  };
}

/**
 * add History plugin
 * @param {Schema} schema
 * @param {Object} options
 */
function addHistory(schema, options) {
  options = options || {};
  if (options.watchAll === true) {
    options.fieldsToWatch = Object.keys(schema.paths);
  }
  options.fieldsToWatch = _.chain([])
    .concat(options.fieldsToWatch)
    .filter(function(field) {
      return schema.path(field) || _.includes([VERSION_KEY], field);
    })
    .reject(function(field) {
      return _.includes(['__updates', '_id'], field);
    })
    .value();

  schema.add({
    __updates: [
      {
        type: ObjectId,
        ref: History.modelName,
      },
    ],
  });

  /**
   * model instance method to save with history. A document should use #set()
   * to update in order to get the modified check working properly for
   * embedded document. Otherwise, explicitly #markModified(path) to mark
   * modified of the path.
   * @param  {String}   userid the user making this update
   * @param  {Function} cb     the callback when save is done
   */
  schema.methods.saveWithHistory = function(userid) {
    var doc = this;
    var uid;
    if (!_.isNil(userid)) {
      if (_.isString(userid)) {
        uid = userid;
      } else {
        if (_.isString(userid.userid)) {
          uid = userid.userid;
        }
      }
    }

    assert.ok(uid, 'must specify user id');

    return new Promise(function(resolve, reject) {
      var c = [];
      var h;
      if (!doc.isModified()) {
        return resolve();
      }
      debug('watched field: ' + options.fieldsToWatch);
      options.fieldsToWatch.forEach(function(field) {
        debug(field + ' is modified ' + doc.isModified(field));
        if ((doc.isNew && doc.get(field)) || doc.isModified(field)) {
          c.push({
            p: field,
            v: doc.get(field),
          });
        }
      });
      if (c.length === 0) {
        return resolve();
      }
      h = new History({
        a: Date.now(),
        b: uid,
        c: c,
        t: doc.constructor.modelName,
        i: doc._id,
      });
      debug(h);
      h.save()
        .then(function(historyDoc) {
          if (historyDoc) {
            doc.__updates.push(historyDoc._id);
          }
          return doc.save();
        })
        .then(function(newDoc) {
          resolve(newDoc);
        })
        .catch(reject);
    });
  };
}

module.exports = {
  History: History,
  addHistory: addHistory,
  addVersion: addVersion,
};
