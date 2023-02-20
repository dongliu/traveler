const sanitize = require('sanitize-html');
const _ = require('lodash');
const debug = require('debug')('traveler:req-utils');
const routesUtilities = require('../utilities/routes');

const htmlSanitizeConfiguration = {
  allowedTags: [
    'div',
    'a',
    'legend',
    'span',
    'label',
    'input',
    'figure',
    'figcaption',
    'img',
    'textarea',
    'p',
    'ul',
    'ol',
    'li',
    'pre',
    'strong',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
  ],
  allowedAttributes: {
    div: ['class'],
    span: ['class', 'style'],
    legend: ['id'],
    label: ['class'],
    input: [
      'type',
      'disabled',
      'name',
      'placeholder',
      'required',
      'data-userkey',
      'data-filetype',
      'value',
      'min',
      'max',
    ],
    img: ['name', 'alt', 'width', 'src'],
    textarea: [
      'disabled',
      'name',
      'placeholder',
      'rows',
      'required',
      'data-userkey',
    ],
    a: ['href', 'title', 'target'],
  },
};

/**
 * Check the property list of http request. Set the property to null if it is
 *   not in the give names list. Go next() if at least one in the give names
 *   list, otherwise respond 400
 * @param  {String} list    'body'|'params'|'query'
 * @param  {[String]} names The property list to check against
 * @return {Function}       The middleware
 */
function filter(list, names) {
  return function(req, res, next) {
    let found = false;
    const keys = Object.keys(req[list]);
    keys.forEach(key => {
      if (names.includes(key)) {
        found = true;
      } else {
        req[list][key] = null;
      }
    });
    if (found) {
      return next();
    }
    return res.status(400).send(`cannot find any of ${names} in ${list}`);
  };
}

const sanitizeValue = function(val) {
  if (_.isString(val)) {
    return sanitizeText(val);
  }
  if (_.isFunction(val)) {
    // clean out function
    return null;
  }
  if (_.isPlainObject(val)) {
    return _.mapValues(val, function(input) {
      return sanitizeValue(input);
    });
  }
  if (_.isArray(val)) {
    return val.map(function(input) {
      return sanitizeValue(input);
    });
  }

  // let other types of value go through
  return val;
};

/**
 * Uses the sanitize along with the configuration to return sanitized text
 *
 * @param textToSanitize
 * @returns {string}
 */
function sanitizeText(textToSanitize) {
  return sanitize(textToSanitize, htmlSanitizeConfiguration);
}

/**
 * Sanitize the property list of http request against the give name list.
 * @param  {String} list    'body'|'params'|'query'
 * @param  {[String]} names The list to sanitize
 * @return {Function}       The middleware
 */
function sanitizeMw(list, names) {
  return function(req, res, next) {
    if (!names || names.length === 0) {
      debug(req[list]);
      req[list] = sanitizeValue(req[list]);
      debug(req[list]);
    } else {
      names.forEach(function(n) {
        if (req[list].hasOwnProperty(n)) {
          if (_.isString(req[list][n])) {
            req[list][n] = sanitizeText(req[list][n]);
          }

          if (_.isObject(req[list][n]) || _.isArray(req[list][n])) {
            req[list][n] = sanitizeValue(req[list][n]);
          }
        }
      });
    }
    next();
  };
}

/**
 * Check if the request[list] has all the properties in the names list
 * @param  {String}  list    'body'|'params'|'query'
 * @param  {[String]}  names The property list to check
 * @return {Function}        The middleware
 */
function hasAll(list, names) {
  return function(req, res, next) {
    let i;
    let miss = false;
    let missed;
    for (i = 0; i < names.length; i += 1) {
      if (!req[list].hasOwnProperty(names[i])) {
        miss = true;
        missed = names[i];
        break;
      }
    }
    if (miss) {
      return res.status(400).send(`cannot find ${missed} in ${list}`);
    }
    return next();
  };
}

/**
 * Check if id in the given source exists in collection
 * @param  {String} pName         the parameter name of item id in req source
 * @param  {String} source        the source of pName: params | body | query
 * @param  {Model} collection     the collection model
 * @return {Function}             the middleware
 */
function existSource(pName, source, collection) {
  return function(req, res, next) {
    debug(pName);
    debug(source);
    collection.findById(req[source][pName]).exec(function(err, item) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }

      if (!item) {
        return res.status(404).send(`item ${req[source][pName]} not found`);
      }

      req[req[source][pName]] = item;
      return next();
    });
  };
}

/**
 * Check if id from params exists in collection
 * @param  {String} pName         the parameter name of item id in req object
 * @param  {Model} collection     the collection model
 * @return {Function}             the middleware
 */
function exist(pName, collection) {
  return existSource(pName, 'params', collection);
}

/**
 * check if the document in a certain status (list)
 * @param  {String} pName the parameter name of item id in req object
 * @param  {[Number]} sList the allowed status list
 * @return {Function}       the middleware
 */
function status(pName, sList) {
  return function(req, res, next) {
    const s = req[req.params[pName]].status;
    if (sList.indexOf(s) === -1) {
      return res
        .status(400)
        .send(
          `request is not allowed for item ${req.params[pName]} status ${s}`
        );
    }
    return next();
  };
}

/**
 * check if the document is archived
 * @param  {String} pName the parameter name of item id in req object
 * @param  {Boolean} a    true or false
 * @return {Function}     the middleware
 */
function archived(pName, a) {
  return function(req, res, next) {
    const arch = req[req.params[pName]].archived;
    if (a !== arch) {
      return res
        .status(400)
        .send(
          `request is not allowed for item ${req.params[pName]} archived ${arch}`
        );
    }
    return next();
  };
}

/** ***
access := -1 // no access
        | 0  // read
        | 1  // write
**** */

function getAccess(req, doc) {
  if (doc.publicAccess === 1) {
    return 1;
  }

  let userid;
  let memberOf;
  if (req.user) {
    userid = req.user.id;
    memberOf = req.user.memberOf;
  } else {
    userid = req.session.userid;
    memberOf = req.session.memberOf;
  }

  if (doc.createdBy === userid && !doc.owner) {
    return 1;
  }
  if (doc.owner === userid) {
    return 1;
  }
  if (routesUtilities.checkUserRole(req, 'admin')) {
    return 1;
  }
  if (
    doc.__review &&
    doc.__review.reviewRequests &&
    doc.__review.reviewRequests.id(req.session.userid)
  ) {
    return 1;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid)) {
    return doc.sharedWith.id(req.session.userid).access;
  }
  let i;
  if (doc.sharedGroup && req.session.memberOf) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (
        doc.sharedGroup.id(memberOf[i]) &&
        doc.sharedGroup.id(memberOf[i]).access === 1
      ) {
        return 1;
      }
    }
    for (i = 0; i < memberOf.length; i += 1) {
      if (doc.sharedGroup.id(memberOf[i])) {
        return 0;
      }
    }
  }
  if (doc.constructor.modelName === 'Traveler') {
    if (routesUtilities.checkUserRole(req, 'write_active_travelers')) {
      return 1;
    }
  }
  if (doc.constructor.modelName === 'Form') {
    if (routesUtilities.checkUserRole(req, 'read_all_forms')) {
      return 0;
    }
  }
  if (doc.publicAccess === 0) {
    return 0;
  }
  return -1;
}

function canWrite(req, doc) {
  return getAccess(req, doc) === 1;
}

/**
 * check if the user can write the document, and go next if yes
 * @param  {String} pName the document to check
 * @return {Function}     the middleware
 */
function canWriteMw(pName) {
  return function(req, res, next) {
    if (!canWrite(req, req[req.params[pName]])) {
      return res
        .status(403)
        .send('you are not authorized to access this resource');
    }
    return next();
  };
}

function canRead(req, doc) {
  return getAccess(req, doc) >= 0;
}

/**
 * check if the user can read the document, and go next if yes
 * @param  {String} pName the parameter name identifying the object
 * @param  {String} source  the source of pname in request, default params
 * @return {Function}     the middleware
 */
function canReadMw(pName, source = 'params') {
  return function(req, res, next) {
    if (!canRead(req, req[req[source][pName]])) {
      return res
        .status(403)
        .send('you are not authorized to access this resource');
    }
    return next();
  };
}

function isOwner(req, doc) {
  if (
    (doc.createdBy === req.session.userid ||
      doc.releasedBy === req.session.userid) &&
    !doc.owner
  ) {
    return true;
  }
  if (doc.owner === req.session.userid) {
    return true;
  }
  return false;
}

/**
 * check if the user is the owner of the document, if yes next()
 * @param  {String}  pName the object's id to check
 * @return {Function}      the middleware
 */
function isOwnerMw(pName) {
  return function(req, res, next) {
    if (!isOwner(req, req[req.params[pName]])) {
      return res
        .status(403)
        .send('you are not authorized to access this resource');
    }
    return next();
  };
}

/**
 * check if the user is the owner of the document, or is admin, if yes next()
 * @param  {String}  pName the object's id to check
 * @return {Function}      the middleware
 */
function isOwnerOrAdminMw(pName) {
  return function(req, res, next) {
    if (
      isOwner(req, req[req.params[pName]]) ||
      routesUtilities.checkUserRole(req, 'admin')
    ) {
      return next();
    }
    return res
      .status(403)
      .send('you are not authorized to access this resource');
  };
}

function requireOwner(condition, pName) {
  return function(req, res, next) {
    let pre = true;
    if (_.isFunction(condition)) {
      pre = condition(req, res);
    }
    if (!pre) {
      return next();
    }
    if (!isOwner(req, req[req.params[pName]])) {
      return res
        .status(403)
        .send('you are not authorized to access this resource');
    }
    return next();
  };
}

function getSharedWith(sharedWith, name) {
  let i;
  if (sharedWith.length === 0) {
    return -1;
  }
  for (i = 0; i < sharedWith.length; i += 1) {
    if (sharedWith[i].username === name) {
      return i;
    }
  }
  return -1;
}

function getSharedGroup(sharedGroup, id) {
  let i;
  if (sharedGroup.length === 0) {
    return -1;
  }
  for (i = 0; i < sharedGroup.length; i += 1) {
    if (sharedGroup[i]._id === id) {
      return i;
    }
  }
  return -1;
}

module.exports = {
  filter,
  hasAll,
  sanitize: sanitizeMw,
  sanitizeText,
  exist,
  existSource,
  status,
  archived,
  canRead,
  canReadMw,
  canWrite,
  canWriteMw,
  isOwner,
  isOwnerMw,
  isOwnerOrAdminMw,
  getAccess,
  getSharedWith,
  getSharedGroup,
  requireOwner,
};
