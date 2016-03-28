/**
 * check the request body against a list of strings. Set the property to null
 * if it is not in the list. Go next if any of the list is found in body,
 * otherwise respond with 400
 * @param  {String[]} strings the list of string to check against
 * @return {Function}         the middleware
 */
function filterBody(strings) {
  return function (req, res, next) {
    var k;
    var found = false;
    for (k in req.body) {
      if (req.body.hasOwnProperty(k)) {
        if (strings.indexOf(k) !== -1) {
          found = true;
        } else {
          req.body[k] = null;
        }
      }
    }
    if (found) {
      next();
    } else {
      return res.send(400, 'cannot find required information in body');
    }
  };
}

/**
 * check the request body against a list of strings. Go next if all in the
 * list are found in the body, otherwise respond 400.
 * @param  {String[]} strings The list of strings to check against
 * @return {Function}         The middleware
 */
function filterBodyAll(strings) {
  return function (req, res, next) {
    var i;
    var miss = false;
    for (i = 0; i < strings.length; i += 1) {
      if (!req.body.hasOwnProperty(strings[i])) {
        miss = true;
        break;
      }
    }
    if (miss) {
      return res.send(400, 'cannot find required information in body');
    }
    next();
  };
}

/**
 * A middleware to check if id exists in collection
 * @param  {String} pName         the parameter name of item id in req object
 * @param  {Model} collection     the collection model
 * @return {Function}             the middleware
 */
function exist(pName, collection) {
  return function (req, res, next) {
    collection.findById(req.params[pName]).exec(function (err, item) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }

      if (!item) {
        return res.send(404, 'item ' + req.params[pName] + ' not found');
      }

      req[req.params[pName]] = item;
      next();
    });
  };
}

/*****
access := -1 // no access
        | 0  // read
        | 1  // write
*****/

function getAccess(req, doc) {
  if (doc.publicAccess === 1) {
    return 1;
  }
  if (doc.createdBy === req.session.userid && !doc.owner) {
    return 1;
  }
  if (doc.owner === req.session.userid) {
    return 1;
  }
  if (doc.sharedWith && doc.sharedWith.id(req.session.userid)) {
    return doc.sharedWith.id(req.session.userid).access;
  }
  var i;
  if (doc.sharedGroup) {
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i]) && doc.sharedGroup.id(req.session.memberOf[i]).access === 1) {
        return 1;
      }
    }
    for (i = 0; i < req.session.memberOf.length; i += 1) {
      if (doc.sharedGroup.id(req.session.memberOf[i])) {
        return 0;
      }
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
  return function (req, res, next) {
    if (!canWrite(req, req[req.params[pName]])) {
      return res.send(403, 'you are not authorized to access this resource');
    }
    next();
  };
}


function canRead(req, doc) {
  return getAccess(req, doc) >= 0;
}

/**
 * check if the user can read the document, and go next if yes
 * @param  {String} pName the parameter name identifying the object
 * @return {Function}     the middleware
 */
function canReadMw(pName) {
  return function (req, res, next) {
    if (!canRead(req, req[req.params[pName]])) {
      return res.send(403, 'you are not authorized to access this resource');
    }
    next();
  };
}

function isOwner(req, doc) {
  if (doc.createdBy === req.session.userid && !doc.owner) {
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
  return function (req, res, next) {
    if (!isOwner(req, req[req.params[pName]])) {
      return res.send(403, 'you are not authorized to access this resource');
    }
    next();
  };
}

function getSharedWith(sharedWith, name) {
  var i;
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
  var i;
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
  filterBody: filterBody,
  filterBodyAll: filterBodyAll,
  exist: exist,
  canRead: canRead,
  canReadMw: canReadMw,
  canWrite: canWrite,
  canWriteMw: canWriteMw,
  isOwner: isOwner,
  isOwnerMw: isOwnerMw,
  getAccess: getAccess,
  getSharedWith: getSharedWith,
  getSharedGroup: getSharedGroup
};
