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
  }
};

module.exports = {
  filterBody: filterBody,
  checkUserRole: checkUserRole,
  getRenderObject: getRenderObject,
  getDeviceValue: getDeviceValue,
  deviceRemovalAllowed: deviceRemovalAllowed,
  form: form,
  traveler: traveler
};
