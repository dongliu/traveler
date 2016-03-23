function filterBody(strings) {
  return function (req, res, next) {
    var k, found = false;
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
 * @param  {String} id            the parameter name of item id in req object
 * @param  {Model} collection     the collection model
 * @return {Function}             the next()
 */
function exist(id, collection) {
  return function (req, res, next) {
    collection.findById(req.params[id]).exec(function (err, item) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }

      if (!item) {
        return res.send(404, 'item ' + req.params[id] + ' not found');
      }

      req[req.params[id]] = item;
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
  return (getAccess(req, doc) === 1);
}

function canRead(req, doc) {
  return (getAccess(req, doc) >= 0);
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
  canWrite: canWrite,
  isOwner: isOwner,
  getAccess: getAccess,
  getSharedWith: getSharedWith,
  getSharedGroup: getSharedGroup
};
