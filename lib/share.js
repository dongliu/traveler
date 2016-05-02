/*jslint es5: true*/

var ad = require('../config/ad.json');
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
    scope: 'sub'
  };

  ldapClient.search(ad.searchBase, opts, false, function (err, result) {
    if (err) {
      console.error(err.name + ' : ' + err.message);
      return res.json(500, err);
    }

    if (result.length === 0) {
      return res.send(400, name + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, name + ' is not unique!');
    }

    var id = result[0].sAMAccountName.toLowerCase();
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    doc.sharedWith.addToSet({
      _id: id,
      username: name,
      access: access
    });
    doc.save(function (docErr) {
      if (docErr) {
        console.error(docErr);
        return res.send(500, docErr.message);
      }
      var user = new User({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail,
        office: result[0].physicalDeliveryOfficeName,
        phone: result[0].telephoneNumber,
        mobile: result[0].mobile
      });
      switch (doc.constructor.modelName) {
      case 'Form':
        user.forms = [doc._id];
        break;
      case 'Traveler':
        user.travelers = [doc._id];
        break;
      case 'WorkPackage':
        user.packages = [doc._id];
        break;
      default:
        console.error('Something is wrong with doc type ' + doc.constructor.modelName);
      }
      user.save(function (userErr) {
        if (userErr) {
          console.error(userErr);
        }
      });
      return res.send(201, 'The user named ' + name + ' was added to the share list.');
    });
  });
}

function addGroupFromAD(req, res, doc) {
  var id = req.body.id.toLowerCase();
  var filter = ad.groupSearchFilter.replace('_id', id);
  var opts = {
    filter: filter,
    attributes: ad.groupAttributes,
    scope: 'sub'
  };

  ldapClient.search(ad.groupSearchBase, opts, false, function (err, result) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }

    if (result.length === 0) {
      return res.send(400, id + ' is not found in AD!');
    }

    if (result.length > 1) {
      return res.send(400, id + ' is not unique!');
    }

    var name = result[0].displayName;
    var access = 0;
    if (req.body.access && req.body.access === 'write') {
      access = 1;
    }
    doc.sharedGroup.addToSet({
      _id: id,
      groupname: name,
      access: access
    });
    doc.save(function (docErr) {
      if (docErr) {
        console.error(docErr);
        return res.send(500, docErr.message);
      }
      var group = new Group({
        _id: result[0].sAMAccountName.toLowerCase(),
        name: result[0].displayName,
        email: result[0].mail
      });
      switch (doc.constructor.modelName) {
      case 'Form':
        group.forms = [doc._id];
        break;
      case 'Traveler':
        group.travelers = [doc._id];
        break;
      case 'WorkPackage':
        group.packages = [doc._id];
        break;
      default:
        console.error('Something is wrong with doc type ' + doc.constructor.modelName);
      }
      group.save(function (groupErr) {
        if (groupErr) {
          console.error(groupErr);
        }
      });
      return res.send(201, 'The group ' + id + ' was added to the share list.');
    });
  });
}

function addUser(req, res, doc) {
  var name = req.body.name;
  // check local db first then try ad
  User.findOne({
    name: name
  }, function (err, user) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    if (user) {
      var access = 0;
      if (req.body.access && req.body.access === 'write') {
        access = 1;
      }
      doc.sharedWith.addToSet({
        _id: user._id,
        username: name,
        access: access
      });
      doc.save(function (docErr) {
        if (docErr) {
          console.error(docErr);
          return res.send(500, docErr.message);
        }
        return res.send(201, 'The user named ' + name + ' was added to the share list.');
      });
      var addToSet = {};
      switch (doc.constructor.modelName) {
      case 'Form':
        addToSet.forms = doc._id;
        break;
      case 'Traveler':
        addToSet.travelers = doc._id;
        break;
      case 'WorkPackage':
        addToSet.packages = doc._id;
        break;
      default:
        console.error('Something is wrong with doc type ' + doc.constructor.modelName);
      }
      user.update({
        $addToSet: addToSet
      }, function (useErr) {
        if (useErr) {
          console.error(useErr);
        }
      });
    } else {
      addUserFromAD(req, res, doc);
    }
  });
}

function addGroup(req, res, doc) {
  var id = req.body.id.toLowerCase();
  // check local db first then try ad
  Group.findOne({
    _id: id
  }, function (err, group) {
    if (err) {
      console.error(err);
      return res.send(500, err.message);
    }
    if (group) {
      var access = 0;
      if (req.body.access && req.body.access === 'write') {
        access = 1;
      }
      doc.sharedGroup.addToSet({
        _id: id,
        groupname: group.name,
        access: access
      });
      doc.save(function (docErr) {
        if (docErr) {
          console.error(docErr);
          return res.send(500, docErr.message);
        }
        return res.send(201, 'The group ' + id + ' was added to the share list.');
      });
      var addToSet = {};
      switch (doc.constructor.modelName) {
      case 'Form':
        addToSet.forms = doc._id;
        break;
      case 'Traveler':
        addToSet.travelers = doc._id;
        break;
      case 'WorkPackage':
        addToSet.packages = doc._id;
        break;
      default:
        console.error('Something is wrong with doc type ' + doc.constructor.modelName);
      }
      group.update({
        $addToSet: addToSet
      }, function (groupErr) {
        if (groupErr) {
          console.error(groupErr);
        }
      });
    } else {
      addGroupFromAD(req, res, doc);
    }
  });
}

/**
 * add a user or a group into a document's share list
 * @param  {ClientRequest}   req http request object
 * @param  {ServerResponse}   res http response object
 * @param  {Documment}   doc the document to share
 * @return {Function} the middleware
 */
function addShare(req, res, doc) {
  if (['Form', 'Traveler', 'WorkPackage'].indexOf(doc.constructor.modelName) === -1) {
    return res.send(500, 'cannot handle the document type ' + doc.constructor.modelName);
  }
  if (req.params.list === 'users') {
    addUser(req, res, doc);
  }

  if (req.params.list === 'groups') {
    addGroup(req, res, doc);
  }
}

module.exports = {
  addShare: addShare
};
