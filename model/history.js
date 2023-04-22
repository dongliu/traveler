const mongoose = require('mongoose');

const { Schema } = mongoose;
const { Mixed } = Schema.Types;
const { ObjectId } = Schema.Types;
const assert = require('assert');

const debug = require('debug')('traveler:history');
const _ = require('lodash');
const logger = require('../lib/loggers').getLogger();

const VERSION_KEY = '_v';

/** ********
 * p: the property/path of an object
 * v: the change-to value of the property
 ********* */
const change = new Schema({
  p: {
    type: String,
    required: true,
  },
  v: {
    type: Mixed,
  },
});

/** ********
 * a: at, the date of the history
 * b: by, the author of the history
 * t: type, the object's type
 * i: id, the object's id
 * c: the array of changes
 ********* */
const history = new Schema({
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

const History = mongoose.model('History', history);

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
      // exclude history updates, id, mongoose version, history version key
      return _.includes(['__updates', '_id', '__v', VERSION_KEY], field);
    })
    .value();

  schema.add({
    _v: { type: Number, default: 0 },
  });

  schema.methods.incrementVersion = function() {
    const doc = this;
    const version = doc.get(VERSION_KEY) || 0;
    debug(options.fieldsToVersion);
    for (let i = 0; i < options.fieldsToVersion.length; i += 1) {
      const field = options.fieldsToVersion[i];
      debug(`${field} is modified ${doc.isModified(field)}`);
      if (
        (doc.isNew && doc.get(field) !== undefined) ||
        doc.isModified(field)
      ) {
        doc.set(VERSION_KEY, version + 1);
        return;
      }
    }
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
   * @param  {String || any} userid the user making this update
   * @returns {Promise<ReleasedForm>} a promise resolve the the doc or new doc or reject with error
   */
  schema.methods.saveWithHistory = async function(userid) {
    const doc = this;
    let uid;
    if (!_.isNil(userid)) {
      if (_.isString(userid)) {
        uid = userid;
      } else if (_.isString(userid.userid)) {
        uid = userid.userid;
      }
    }

    assert.ok(uid, 'must specify user id');

    const c = [];
    if (!doc.isModified()) {
      return doc;
    }

    debug(`watched field: ${options.fieldsToWatch}`);
    options.fieldsToWatch.forEach(function(field) {
      debug(`${field} is modified ${doc.isModified(field)}`);
      if (
        (doc.isNew && doc.get(field) !== undefined) ||
        doc.isModified(field)
      ) {
        c.push({
          p: field,
          v: doc.get(field),
        });
      }
    });
    if (c.length === 0) {
      return doc;
    }
    const h = new History({
      a: Date.now(),
      b: uid,
      c,
      t: doc.constructor.modelName,
      i: doc._id,
    });
    debug(h);

    let historyDoc;
    try {
      historyDoc = await h.save();
    } catch (error) {
      logger.error(error.message);
      throw error;
    }

    if (historyDoc) {
      doc.__updates.push(historyDoc._id);
    }

    try {
      const newDoc = await doc.save();
      return newDoc;
    } catch (error) {
      logger.error(error.message);
      throw error;
    }
  };
}

module.exports = {
  History,
  addHistory,
  addVersion,
};
