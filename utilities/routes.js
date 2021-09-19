/**
 * Created by djarosz on 11/6/15.
 */
/**
 * The purpose of this file is to store all functions and utilities that are used by multiple routes.
 */
var config = require('../config/config.js');

var Traveler = require('../model/traveler').Traveler;
var Binder = require('../model/binder').Binder;
var _ = require('lodash');
var cheer = require('cheerio');

const formStatusMap = require('../model/released-form').statusMap;

var TravelerError = require('../lib/error').TravelerError;

var devices = require('./devices/default.js');
// Override devices for a specific component system.
if (config.service.device_application === 'cdb') {
  devices = require('./devices/cdb.js');
}

function filterBody(strings, findAll) {
  return filterBodyWithOptional(strings, findAll, undefined);
}

function filterBodyWithOptional(requiredStrings, findAll, optionalStrings) {
  var strings = requiredStrings;
  if (optionalStrings !== undefined) {
    strings = requiredStrings.concat(optionalStrings);
  }

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
    } else if (findAll && foundCount >= requiredStrings.length) {
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
  return new Promise(function(resolve) {
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

  deleteWork: function(binder, workId, userId, req, res) {
    var work = binder.works.id(workId);

    if (!work) {
      return res
        .status(404)
        .send('Work ' + req.params.wid + ' not found in the binder.');
    }

    work.remove();
    binder.updatedBy = userId;
    binder.updatedOn = Date.now();

    binder.updateProgress(function(err, newPackage) {
      if (err) {
        console.log(err);
        return res.status(500).send(err.message);
      }
      return res.json(newPackage);
    });
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

function addDiscrepancy(discrepancy, traveler) {
  // migrate traveler without discrepancyForms
  if (!traveler.discrepancyForms) {
    traveler.discrepancyForms = [];
  }
  traveler.discrepancyForms.push(discrepancy);
  // set reference for compatibility, discrepancy._id is the same as the discrepancy form id
  traveler.discrepancyForms[0].reference = discrepancy._id;
  traveler.activeDiscrepancyForm = traveler.discrepancyForms[0]._id;
  traveler.referenceDiscrepancyForm = discrepancy._id;
}

function addBase(base, traveler) {
  traveler.forms.push(base);
  // set reference for compatibility, base._id is the same as the base form id
  traveler.forms[0].reference = base._id;
  traveler.activeForm = traveler.forms[0]._id;
  traveler.mapping = base.mapping;
  traveler.labels = base.labels;
  traveler.totalInput = _.size(base.labels);
}
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
    if (
      form.formType &&
      form.formType !== 'normal' && form.formType !== 'normal_discrepancy'
    ) {
      return newTravelerCallBack(
        new TravelerError(
          `cannot create a traveler from ${form.id} of non normal type`,
          400
        )
      );
    }

    if (formStatusMap['' + form.status] !== 'released') {
      return newTravelerCallBack(
        new TravelerError(
          `cannot create a traveler from a non-released form ${form.id}`,
          400
        )
      );
    }

    var traveler = new Traveler({
      title: title,
      description: '',
      devices: devices,
      tags: form.base.tags,
      status: 0,
      createdBy: userName,
      createdOn: Date.now(),
      sharedWith: [],
      referenceReleasedForm: form._id,
      referenceReleasedFormVer: form.ver,
      forms: [],
      data: [],
      comments: [],
      finishedInput: 0,
      touchedInputs: [],
    });

    // for old forms without lables
    // if (!(_.isObject(form.base.labels) && _.size(form.base.labels) > 0)) {
    //   form.base.labels = this.inputLabels(form.base.html);
    // }
    addBase(form.base, traveler);
    if (form.discrepancy) {
      addDiscrepancy(form.discrepancy, traveler);
    }
    traveler.save(newTravelerCallBack);
  },
  changeArchivedState: function(traveler, archived) {
    traveler.archived = archived;

    if (traveler.archived) {
      traveler.archivedOn = Date.now();
    }
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
  canWrite: function(req, travelerDoc) {
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
  filterBodyWithOptional: filterBodyWithOptional,
  checkUserRole: checkUserRole,
  getRenderObject: getRenderObject,
  getDeviceValue: getDeviceValue,
  deviceRemovalAllowed: deviceRemovalAllowed,
  traveler: traveler,
  binder: binder,
};
