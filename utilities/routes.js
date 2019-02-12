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
var Binder = mongoose.model('Binder');
var _ = require('underscore');
var cheer = require('cheerio');

var devices = require('./devices/default.js');
// Override devices for a specific component system.
if (config.service.device_application === 'cdb') {
  devices = require('./devices/cdb.js');
}

function filterBody(strings, findAll) {
  return function(req, res, next) {
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
      return res.send(500, error);
    }
  };
}

function filterBodyAll(strings) {
  return function(req, res, next) {
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
  if (
    req.session.roles !== undefined &&
    req.session.roles.indexOf(role) !== -1
  ) {
    return true;
  } else {
    return false;
  }
}

function getRenderObject(req, extraAttributes) {
  var renderObject = {
    prefix: req.proxied ? req.proxied_prefix : '',
    viewConfig: config.viewConfig,
    roles: req.session.roles,
    helper: {
      upperCaseFirstLetter: function(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
      },
    },
  };
  if (extraAttributes !== undefined) {
    for (var key in extraAttributes) {
      renderObject[key] = extraAttributes[key];
    }
  }
  return renderObject;
}

function getDeviceValue(value) {
  return new Promise(function(resolve, reject) {
    var deviceIndex = 0;
    processNextDevice();

    function processNextDevice() {
      if (value.length > deviceIndex) {
        devices.getDeviceValue(value[deviceIndex], function(curDeviceValue) {
          value[deviceIndex] = curDeviceValue;
          deviceIndex++;
          processNextDevice();
        });
      } else {
        resolve(value);
      }
    }
  });
}

function deviceRemovalAllowed() {
  return devices.devicesRemovalAllowed;
}

var form = {
  //Parameters for newFormResultCallBack are (err, newForm)
  createForm: function(title, createdBy, html, newFormResultCallBack) {
    var formToCreate = {};
    formToCreate.title = title;
    formToCreate.createdBy = createdBy;
    formToCreate.createdOn = Date.now();
    formToCreate.html = html;
    formToCreate.sharedWith = [];
    new Form(formToCreate).save(newFormResultCallBack);
  },
};

var binder = {
  createBinder: function(
    title,
    description,
    createdBy,
    newBinderResultCallback
  ) {
    var binderToCreate = {};
    binderToCreate.title = title;
    binderToCreate.description = description;
    binderToCreate.createdBy = createdBy;
    binderToCreate.createdOn = Date.now();
    new Binder(binderToCreate).save(newBinderResultCallback);
  },

  addWork: function(binder, userId, req, res) {
    var tids = req.body.travelerIds;
    var pids = req.body.binders;
    var ids;
    var type;
    var model;
    if (tids) {
      if (tids.length === 0) {
        return res.send(204);
      }
      type = 'traveler';
      model = Traveler;
      ids = tids;
    } else {
      if (pids.length === 0) {
        return res.send(204);
      }
      type = 'binder';
      model = Binder;
      ids = pids;
    }

    var works = binder.works;
    var added = [];

    model
      .find({
        _id: {
          $in: ids,
        },
      })
      .exec(function(err, items) {
        if (err) {
          console.error(err);
          return res.send(500, err.message);
        }

        if (items.length === 0) {
          return res.send(204);
        }

        items.forEach(function(item) {
          if (type === 'binder' && item.id === binder.id) {
            // do not add itself as a work
            return;
          }
          var newWork;
          if (!works.id(item._id)) {
            newWork = {
              _id: item._id,
              alias: item.title,
              refType: type,
              addedOn: Date.now(),
              addedBy: userId,
              status: item.status || 0,
              value: item.value || 10,
            };
            if (item.status === 2) {
              newWork.finished = 1;
              newWork.inProgress = 0;
            } else if (item.status === 0) {
              newWork.finished = 0;
              newWork.inProgress = 0;
            } else {
              if (type === 'traveler') {
                newWork.finished = 0;
                if (item.totalInput === 0) {
                  newWork.inProgress = 1;
                } else {
                  newWork.inProgress = item.finishedInput / item.totalInput;
                }
              } else {
                if (item.totalValue === 0) {
                  newWork.finished = 0;
                  newWork.inProgress = 1;
                } else {
                  newWork.finished = item.finishedValue / item.totalValue;
                  newWork.inProgress = item.inProgressValue / item.totalValue;
                }
              }
            }

            works.push(newWork);
            added.push(item.id);
          }
        });

        if (added.length === 0) {
          return res.send(204);
        }

        binder.updatedOn = Date.now();
        binder.updatedBy = userId;

        // update the totalValue, finishedValue, and finishedValue
        binder.updateProgress(function(saveErr, newBinder) {
          if (saveErr) {
            console.error(saveErr);
            return res.send(500, saveErr.message);
          }
          return res.json(200, newBinder);
        });
      });
  },
};

var traveler = {
  /**
   * get the map of input name -> label in the form
   * @param  {String} html form html
   * @return {Object}     the map of input name -> label
   */
  inputLabels: function(html) {
    var $ = cheer.load(html);
    var inputs = $('input, textarea');
    var lastInputName = '';
    var i;
    var input;
    var inputName = '';
    var label = '';
    var map = {};
    for (i = 0; i < inputs.length; i += 1) {
      input = $(inputs[i]);
      inputName = input.attr('name');
      label = input
        .closest('.control-group')
        .children('.control-label')
        .children('span')
        .text();
      if (inputName) {
        inputName = inputName.trim();
      }
      if (label) {
        label = label.trim();
      }
      if (!inputName) {
        continue;
      }
      if (lastInputName !== inputName) {
        map[inputName] = label;
      }
      lastInputName = inputName;
    }
    return map;
  },
  createTraveler: function(
    form,
    title,
    userName,
    devices,
    newTravelerCallBack
  ) {
    var traveler = new Traveler({
      title: title,
      description: '',
      devices: devices,
      tags: form.tags,
      status: 0,
      createdBy: userName,
      createdOn: Date.now(),
      sharedWith: [],
      referenceForm: form._id,
      forms: [],
      data: [],
      comments: [],
      finishedInput: 0,
      touchedInputs: [],
    });

    // for old forms without lables
    if (!(_.isObject(form.labels) && _.size(form.labels) > 0)) {
      form.labels = this.inputLabels(form.html);
    }

    traveler.forms.push({
      html: form.html,
      activatedOn: [Date.now()],
      reference: form._id,
      alias: form.title,
      mapping: form.mapping,
      labels: form.labels,
    });
    traveler.activeForm = traveler.forms[0]._id;
    traveler.mapping = form.mapping;
    traveler.labels = form.labels;
    traveler.totalInput = _.size(traveler.labels);

    traveler.save(newTravelerCallBack);
  },
  updateTravelerStatus: function(
    req,
    res,
    travelerDoc,
    status,
    isSession,
    onSuccess
  ) {
    if (isSession) {
      if (status === 1.5) {
        if (!traveler.canWriteActive(req, travelerDoc)) {
          return res.send(
            403,
            'You are not authorized to access this resource'
          );
        }
      } else {
        if (travelerDoc.createdBy !== req.session.userid) {
          return res.send(
            403,
            'You are not authorized to access this resource'
          );
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
            return res.send(
              400,
              'cannot start to work from the current status'
            );
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
    if (
      travelerDoc.sharedWith &&
      travelerDoc.sharedWith.id(req.session.userid) &&
      travelerDoc.sharedWith.id(req.session.userid).access === 1
    ) {
      return true;
    }
    var i;
    if (travelerDoc.sharedGroup) {
      for (i = 0; i < req.session.memberOf.length; i += 1) {
        if (
          travelerDoc.sharedGroup.id(req.session.memberOf[i]) &&
          travelerDoc.sharedGroup.id(req.session.memberOf[i]).access === 1
        ) {
          return true;
        }
      }
    }
    return false;
  },
};

module.exports = {
  filterBody: filterBody,
  filterBodyAll: filterBodyAll,
  checkUserRole: checkUserRole,
  getRenderObject: getRenderObject,
  getDeviceValue: getDeviceValue,
  deviceRemovalAllowed: deviceRemovalAllowed,
  form: form,
  traveler: traveler,
  binder: binder,
};
