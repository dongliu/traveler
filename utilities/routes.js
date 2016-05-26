/**
 * Created by djarosz on 11/6/15.
 */
/**
 * The purpose of this file is to store all functions and utilities that are used by multiple routes.
 */
var config = require('../config/config.js');

var mongoose = require('mongoose');
var Form = mongoose.model('Form');
var Traveler = mongoose.model('Traveler');
var cheer = require('cheerio');

var devices = require('./devices/default.js');
// Override devices for a specific component system.
if (config.service.device_application === 'cdb') {
  devices = require('./devices/cdb.js');
}

function filterBody(strings, findAll) {
  return function (req, res, next) {
    var k;
    var foundCount = 0;
    for (k in req.body) {
      if (req.body.hasOwnProperty(k)) {
        var index = strings.indexOf(k);
        if (index !== -1) {
          foundCount = foundCount + 1;
        } else {
          req.body[k] = null;
        }
      }
    }
    if (!findAll && foundCount > 0) {
      next();
    } else if (findAll && foundCount === strings.length) {
      next();
    } else {
      var error;
      if (findAll) {
        error = 'Cannot find all the required parameters: ' + strings;
      } else if (!findAll) {
        error = 'Cannot find any of the required parameters: ' + strings;
      }
      return res.send(error);
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

function checkUserRole(req, role) {
  if (req.session.roles !== undefined && req.session.roles.indexOf(role) !== -1) {
    return true;
  }
  else {
    return false;
  }
}

function getRenderObject(req, extraAttributes) {
  var renderObject = {
    prefix: req.proxied ? req.proxied_prefix : '',
    viewConfig: config.viewConfig,
    helper: {
      upperCaseFirstLetter: function (text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
      }
    }
  };
  if (extraAttributes !== undefined) {
    for (var key in extraAttributes) {
      renderObject[key] = extraAttributes[key];
    }
  }
  return renderObject;
}

function getDeviceValue(value){
  return new Promise(function(resolve, reject){
    var deviceIndex = 0;
    processNextDevice();

    function processNextDevice(){
      if(value.length > deviceIndex) {
        devices.getDeviceValue(value[deviceIndex], function(curDeviceValue){
          value[deviceIndex] = curDeviceValue;
          deviceIndex ++;
          processNextDevice();
        })
      } else {
        resolve(value)
      }
    }
  });
}

function deviceRemovalAllowed(){
  return devices.devicesRemovalAllowed;
}

var form = {
  //Parameters for newFormResultCallBack are (err, newForm)
  createForm: function (title, createdBy, html, newFormResultCallBack) {
    var formToCreate = {};
    formToCreate.title = title;
    formToCreate.createdBy = createdBy;
    formToCreate.createdOn = Date.now();
    formToCreate.html = html;
    formToCreate.sharedWith = [];
    (new Form(formToCreate)).save(newFormResultCallBack);
  }
};

var traveler = {
  // Parameters for newTravelerCallBack are (err, traveler)
  createTraveler: function (form, title, userName, devices, newTravelerCallBack) {
    // update the total input number and finished input number
    var $ = cheer.load(form.html);
    var num = $('input, textarea').length;
    // console.log('total input number is ' + num);
    var traveler = new Traveler({
      title: title,
      description: '',
      devices: devices,
      status: 0,
      createdBy: userName,
      createdOn: Date.now(),
      sharedWith: [],
      referenceForm: form._id,
      forms: [{
        html: form.html
      }],
      data: [],
      comments: [],
      totalInput: num,
      finishedInput: 0
    });
    traveler.save(newTravelerCallBack);
  },
  updateTravelerStatus: function (req, res, travelerDoc, status, isSession, onSuccess) {
    if (isSession) {
      if (status === 1.5) {
        if (!traveler.canWriteActive(req, travelerDoc)) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      } else {
        if (travelerDoc.createdBy !== req.session.userid) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      }
    }

    if (travelerDoc.status == status) {
      // Nothing to update
      onSuccess();
    } else {
      switch (status) {
        case 1:
          if ([0, 1.5, 3].indexOf(travelerDoc.status) !== -1) {
            travelerDoc.status = status;
          } else {
            return res.send(400, 'cannot start to work from the current status');
          }
          break;
        case 1.5:
          if ([1].indexOf(travelerDoc.status) !== -1) {
            travelerDoc.status = status;
          } else {
            return res.send(400, 'cannot complete from the current status');
          }
          break;
        case 2:
          if ([1, 1.5].indexOf(travelerDoc.status) !== -1) {
            travelerDoc.status = 2;
          } else {
            return res.send(400, 'cannot complete from the current status');
          }
          break;
        case 3:
          if ([1].indexOf(travelerDoc.status) !== -1) {
            travelerDoc.status = 3;
          } else {
            return res.send(400, 'cannot freeze from the current status');
          }
      }
      onSuccess();
    }
  },
  canWriteActive: function(req, travelerDoc) {
    if (traveler.canWrite(req, travelerDoc)) {
      return true;
    } else if (checkUserRole(req, 'write_active_travelers')) {
      return true;
    }

    return false;
  },
  canWrite: function(req, travelerDoc, userid) {
    if (req.session == undefined) {
      return false;
    }

    if (travelerDoc.createdBy === req.session.userid) {
      return true;
    }
    if (travelerDoc.sharedWith && travelerDoc.sharedWith.id(req.session.userid) && travelerDoc.sharedWith.id(req.session.userid).access === 1) {
      return true;
    }
    var i;
    if (travelerDoc.sharedGroup) {
      for (i = 0; i < req.session.memberOf.length; i += 1) {
        if (travelerDoc.sharedGroup.id(req.session.memberOf[i]) && travelerDoc.sharedGroup.id(req.session.memberOf[i]).access === 1) {
          return true;
        }
      }
    }
    return false;
  }
};

module.exports = {
  filterBody: filterBody,
  filterBodyAll: filterBodyAll,
  checkUserRole: checkUserRole,
  getRenderObject: getRenderObject,
  getDeviceValue: getDeviceValue,
  deviceRemovalAllowed: deviceRemovalAllowed,
  form: form,
  traveler: traveler
};
