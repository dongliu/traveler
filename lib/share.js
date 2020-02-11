/*jslint es5: true*/

var config = require('../config/config');
var ad = config.ad;
var ldapClient = require('./ldap-client');

var mongoose = require('mongoose');

var User = mongoose.model('User');
var Group = mongoose.model('Group');

function addUserFromAD(req, res, doc) {
  var name = req.body.name;
  var nameFilter = ad.nameFilter.replace('_name', name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub',
  };

  ldapClient.search(ad.searchBase, opts, false, function(err, result) {
    if (err) {
      console.error(err.name + ' : ' + err.message);
      return res.status(500).json(err);
    }

    if (result.length === 0) {
      return res.status(400).send(name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.status(400).send(name + ' is not unique!');
    }

    var id = result[0].uid.toLowerCase();
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    doc.sharedWith.addToSet({
      _id: id,
      username: name,
      access: access,
    });
    doc.save(function(docErr) {
      if (docErr) {
        console.error(docErr);
        return res.status(500).send(docErr.message);
      }
      var user = new User({
        _id: result[0].uid.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        office: result[0].physicalDeliveryOfficeName,
        phone: result[0].telephoneNumber,
        mobile: result[0].mobile,
      });
      switch (doc.constructor.modelName) {
        case 'Form':
          user.forms = [doc._id];
          break;
        case 'Traveler':
          user.travelers = [doc._id];
          break;
        case 'Binder':
          user.binders = [doc._id];
          break;
        default:
          console.error(
            'Something is wrong with doc type ' + doc.constructor.modelName
          );
      }
      user.save(function(userErr) {
        if (userErr) {
          console.error(userErr);
        }
      });
      return res
        .status(201)
        .send('The user named ' + name + ' was added to the share list.');
    });
  });
}

function addGroupFromAD(req, res, doc) {
  if (!ad.groupSearchFilter) {
    return res.status(500).send('AD not set up for groups');
  }
  var id = req.body.id.toLowerCase();
  var filter = ad.groupSearchFilter.replace('_id', id);
  var opts = {
    filter: filter,
    attributes: ad.groupAttributes,
    scope: 'sub',
  };

  ldapClient.search(ad.groupSearchBase, opts, false, function(err, result) {
    if (err) {
      console.error(err);
      return res.status(500).send(err.message);
    }

    if (result.length === 0) {
      return res.status(400).send(id + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.status(400).send(id + ' is not unique!');
    }

    var name = result[0].displayName;
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    doc.sharedGroup.addToSet({
      _id: id,
      groupname: name,
      access: access,
    });
    doc.save(function(docErr) {
      if (docErr) {
        console.error(docErr);
        return res.status(500).send(docErr.message);
      }
      var group = new Group({
        _id: result[0].uid.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
      });
      switch (doc.constructor.modelName) {
        case 'Form':
          group.forms = [doc._id];
          break;
        case 'Traveler':
          group.travelers = [doc._id];
          break;
        case 'Binder':
          group.binders = [doc._id];
          break;
        default:
          console.error(
            'Something is wrong with doc type ' + doc.constructor.modelName
          );
      }
      group.save(function(groupErr) {
        if (groupErr) {
          console.error(groupErr);
        }
      });
      return res
        .status(201)
        .send('The group ' + id + ' was added to the share list.');
    });
  });
}

function addUser(req, res, doc) {
  var name = req.body.name;
  // check local db first then try ad
  User.findOne(
    {
      name: name,
    },
    function(err, user) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (user) {
        var access = 0;
        if (req.body.access && req.body.access === 'write') {
          access = 1;
        }
        doc.sharedWith.addToSet({
          _id: user._id,
          username: name,
          access: access,
        });
        doc.save(function(docErr) {
          if (docErr) {
            console.error(docErr);
            return res.status(500).send(docErr.message);
          }
          return res
            .status(201)
            .send('The user named ' + name + ' was added to the share list.');
        });
        var addToSet = {};
        switch (doc.constructor.modelName) {
          case 'Form':
            addToSet.forms = doc._id;
            break;
          case 'Traveler':
            addToSet.travelers = doc._id;
            break;
          case 'Binder':
            addToSet.binders = doc._id;
            break;
          default:
            console.error(
              'Something is wrong with doc type ' + doc.constructor.modelName
            );
        }
        user.update(
          {
            $addToSet: addToSet,
          },
          function(useErr) {
            if (useErr) {
              console.error(useErr);
            }
          }
        );
      } else {
        addUserFromAD(req, res, doc);
      }
    }
  );
}

function addGroup(req, res, doc) {
  var id = req.body.id.toLowerCase();
  // check local db first then try ad
  Group.findOne(
    {
      _id: id,
    },
    function(err, group) {
      if (err) {
        console.error(err);
        if (ad.groupSearchFilter) {
          return addGroupFromAD(req, res, doc);
        } else {
          return res.status(500).send(err.message);
        }
      }
      if (group) {
        var access = 0;
        if (req.body.access && req.body.access === 'write') {
          access = 1;
        }
        doc.sharedGroup.addToSet({
          _id: id,
          groupname: group.name,
          access: access,
        });
        doc.save(function(docErr) {
          if (docErr) {
            console.error(docErr);
            return res.status(500).send(docErr.message);
          }
          return res
            .status(201)
            .send('The group ' + id + ' was added to the share list.');
        });
        var addToSet = {};
        switch (doc.constructor.modelName) {
          case 'Form':
            addToSet.forms = doc._id;
            break;
          case 'Traveler':
            addToSet.travelers = doc._id;
            break;
          case 'Binder':
            addToSet.binders = doc._id;
            break;
          default:
            console.error(
              'Something is wrong with doc type ' + doc.constructor.modelName
            );
        }
        group.update(
          {
            $addToSet: addToSet,
          },
          function(groupErr) {
            if (groupErr) {
              console.error(groupErr);
            }
          }
        );
      } else if (ad.groupSearchFilter) {
        addGroupFromAD(req, res, doc);
      } else {
        console.error('Group not found: ' + id);
        return res.status(403).send('Group not found: ' + id);
      }
    }
  );
}

function removeFromList(req, res, doc) {
  // var form = req[req.params.id];
  var list;
  var ids = req.params.shareid.split(',');
  var removed = [];

  if (req.params.list === 'users') {
    list = doc.sharedWith;
  }
  if (req.params.list === 'groups') {
    list = doc.sharedGroup;
  }

  ids.forEach(function(id) {
    var share = list.id(id);
    if (share) {
      removed.push(id);
      share.remove();
    }
  });

  if (removed.length === 0) {
    return res
      .status(400)
      .send('cannot find ' + req.params.shareid + ' in list.');
  }

  doc.save(function(saveErr) {
    if (saveErr) {
      console.error(saveErr);
      return res.status(500).send(saveErr.message);
    }
    // keep the consistency of user's form list
    var Target;
    if (req.params.list === 'users') {
      Target = User;
    }
    if (req.params.list === 'groups') {
      Target = Group;
    }

    var pull = {};
    switch (doc.constructor.modelName) {
      case 'Form':
        pull.forms = doc._id;
        break;
      case 'Traveler':
        pull.travelers = doc._id;
        break;
      case 'Binder':
        pull.binders = doc._id;
        break;
      default:
        console.error(
          'Something is wrong with doc type ' + doc.constructor.modelName
        );
    }

    removed.forEach(function(id) {
      Target.findByIdAndUpdate(
        id,
        {
          $pull: pull,
        },
        function(updateErr, target) {
          if (updateErr) {
            console.error(updateErr);
          }
          if (!target) {
            console.error(
              'The ' + req.params.list + ' ' + id + ' is not in the db'
            );
          }
        }
      );
    });

    return res.status(200).json(removed);
  });
}

/**
 * add a user or a group into a document's share list
 * @param  {ClientRequest}   req http request object
 * @param  {ServerResponse}   res http response object
 * @param  {Documment}   doc the document to share
 * @return {undefined}
 */
function addShare(req, res, doc) {
  if (
    ['Form', 'Traveler', 'Binder'].indexOf(doc.constructor.modelName) === -1
  ) {
    return res
      .status(500)
      .send('cannot handle the document type ' + doc.constructor.modelName);
  }
  if (req.params.list === 'users') {
    addUser(req, res, doc);
  }

  if (req.params.list === 'groups') {
    addGroup(req, res, doc);
  }
}

/**
 * remove a list of users or groups from a document's share list
 * @param  {ClientRequest} req http request object
 * @param  {ServerResponse} res http response object
 * @param  {Documment} doc the document to share
 * @return {undefined}
 */
function removeShare(req, res, doc) {
  if (
    ['Form', 'Traveler', 'Binder'].indexOf(doc.constructor.modelName) === -1
  ) {
    return res
      .status(500)
      .send('cannot handle the document type ' + doc.constructor.modelName);
  }

  removeFromList(req, res, doc);
}

function changeOwner(req, res, doc) {
  // get user id from name here
  var name = req.body.name;
  var nameFilter = ad.nameFilter.replace('_name', name);
  var opts = {
    filter: nameFilter,
    attributes: ad.objAttributes,
    scope: 'sub',
  };

  ldapClient.search(ad.searchBase, opts, false, function(ldapErr, result) {
    if (ldapErr) {
      console.error(ldapErr.name + ' : ' + ldapErr.message);
      return res.status(500).send(ldapErr.message);
    }

    if (result.length === 0) {
      return res.status(400).send(name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.status(400).send(name + ' is not unique!');
    }

    var id = result[0].uid.toLowerCase();

    if (doc.owner === id) {
      return res.status(204).send();
    }

    doc.owner = id;
    doc.transferredOn = Date.now();

    doc.save(function(saveErr) {
      if (saveErr) {
        console.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      return res.status(200).send('Owner is changed to ' + id);
    });
  });
}

module.exports = {
  addShare: addShare,
  removeShare: removeShare,
  changeOwner: changeOwner,
};
