var mongoose = require('mongoose');
var appConfig = require('../config/config').app;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var share = require('./share.js');

/**
 * finished is the percentage of value that is completed.
 * inProgress is the percentage of value that is still in progress.
 * If status === 2, then finished = 100, and inProgress = 0;
 * If status === 0, then finished = 0, and inProgress = 0;
 * finished and inProgress are cached status.
 * totalSteps and finishedteps are cached status.
 * They should be updated when the reference traveler is loaed.
 */

var work = new Schema({
  alias: String,
  refType: {
    type: String,
    required: true,
    enum: ['traveler', 'binder'],
  },
  addedOn: Date,
  addedBy: String,
  status: Number,
  finished: {
    type: Number,
    default: 0,
    min: 0,
  },
  inProgress: {
    type: Number,
    default: 0,
    min: 0,
  },
  finishedInput: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalInput: {
    type: Number,
    default: 0,
    min: 0,
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5,
  },
  sequence: {
    type: Number,
    min: 1,
    default: 1,
  },
  value: {
    type: Number,
    min: 0,
    default: 10,
  },
  color: {
    type: String,
    default: 'blue',
    enum: ['green', 'yellow', 'red', 'blue', 'black'],
  },
});

/**
 * publicAccess := 0 // for read or
 *               | 1 // for write or
 *               | -1 // no access
 *
 */

/**
 * totalValue = sum(work value)
 * finishedValue = sum(work value X finished)
 * inProgressValue = sum(work value X inProgress)
 */

/**
 * status := 0 // new
 *         | 1 // active
 *         | 2 // completed
 *         | 3 // archived
 */

var binder = new Schema({
  title: String,
  description: String,
  status: {
    type: Number,
    default: 0,
  },
  tags: [String],
  createdBy: String,
  createdOn: Date,
  clonedBy: String,
  clonedFrom: ObjectId,
  updatedBy: String,
  updatedOn: Date,
  archivedOn: Date,
  owner: String,
  transferredOn: Date,
  deadline: Date,
  publicAccess: {
    type: Number,
    default: appConfig.default_binder_public_access,
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  works: [work],
  finishedInput: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalInput: {
    type: Number,
    default: 0,
    min: 0,
  },
  // the date that the progress was updated
  progressUpdatedOn: Date,
  finishedValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  inProgressValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  finishedWork: {
    type: Number,
    default: 0,
    min: 0,
  },
  inProgressWork: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalWork: {
    type: Number,
    default: 0,
    min: 0,
  },
  archived: {
    type: Boolean,
    default: false,
  },
});

function updateInputProgress(w, spec) {
  w.totalInput = spec.totalInput;
  w.finishedInput = spec.finishedInput;
}

binder.methods.updateWorkProgress = function(spec) {
  var w = this.works.id(spec._id);
  if (!w) {
    return;
  }
  updateInputProgress(w, spec);
  if (w.status !== spec.status) {
    w.status = spec.status;
  }
  if (spec.status === 2) {
    w.finished = 1;
    w.inProgress = 0;
    return;
  }

  if (spec.status === 0) {
    w.finished = 0;
    w.inProgress = 0;
    return;
  }
  if (w.refType === 'traveler') {
    work.finished = 0;
    if (spec.totalInput === 0) {
      w.inProgress = 1;
    } else {
      w.inProgress = spec.finishedInput / spec.totalInput;
    }
  } else {
    //  the binder
    if (spec.totalValue === 0) {
      w.finished = 0;
      w.inProgress = 1;
    } else {
      w.finished = spec.finishedValue / spec.totalValue;
      w.inProgress = spec.inProgressValue / spec.totalValue;
    }
  }
};

binder.methods.updateProgress = function(cb) {
  var works = this.works;
  var totalValue = 0;
  var finishedValue = 0;
  var inProgressValue = 0;
  var totalWork = 0;
  var finishedWork = 0;
  var inProgressWork = 0;
  var totalInput = 0;
  var finishedInput = 0;
  works.forEach(function(w) {
    totalInput += w.totalInput;
    finishedInput += w.finishedInput;

    totalValue += w.value;
    finishedValue += w.value * w.finished;
    inProgressValue += w.value * w.inProgress;

    totalWork += 1;
    finishedWork += w.finished;
    inProgressWork += w.inProgress;
  });

  this.totalInput = totalInput;
  this.finishedInput = finishedInput;

  this.totalValue = totalValue;
  this.finishedValue = finishedValue;
  this.inProgressValue = inProgressValue;

  this.totalWork = totalWork;
  this.finishedWork = finishedWork;
  this.inProgressWork = inProgressWork;

  if (this.isModified()) {
    this.progressUpdatedOn = Date.now();
    this.save(function(err, newBinder) {
      if (cb) {
        return cb(err, newBinder);
      }
      if (err) {
        console.error(err);
      }
    });
  }
};

var Binder = mongoose.model('Binder', binder);

module.exports = {
  Binder: Binder,
};
