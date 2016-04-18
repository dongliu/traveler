var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var share = require('./share.js');

/**
 * finished is the percentage of value that is completed.
 * inProgress is the percentage of value that is still in progress.
 * If status === 2, then finished = 100, and inProgress = 0;
 */

var work = new Schema({
  alias: String,
  refType: {
    type: String,
    required: true,
    enum: ['traveler', 'package']
  },
  addedOn: Date,
  addedBy: String,
  status: Number,
  finished: {
    type: Number,
    default: 0,
    min: 0
  },
  inProgress: {
    type: Number,
    default: 0,
    min: 0
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  sequence: {
    type: Number,
    min: 1,
    default: 1
  },
  value: {
    type: Number,
    min: 0,
    default: 10
  },
  color: {
    type: String,
    default: 'blue',
    enum: ['green', 'yellow', 'red', 'blue', 'black']
  }
});

/**
 * publicAccess := 0 // for read or
 *               | 1 // for write or
 *               | -1 // no access
 *
 */

/**
 * Currently there is no status for a working package.
 * It is either active or archived.
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
 */

var workingPackage = new Schema({
  title: String,
  description: String,
  status: {
    type: Number,
    default: 0
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
    default: -1
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  works: [work],
  finishedValue: {
    type: Number,
    default: 0,
    min: 0
  },
  inProgressValue: {
    type: Number,
    default: 0,
    min: 0
  },
  totalValue: {
    type: Number,
    default: 0,
    min: 0
  },
  archived: {
    type: Boolean,
    default: false
  }
});

workingPackage.methods.updateWorkProgress = function (spec) {
  var w = this.works.id(spec._id);
  if (!w) {
    return;
  }
  if (spec.status === 2) {
    w.finished = 1;
    w.inProgress = 0;
  } else if (w.refType === 'traveler') {
    work.finished = 0;
    if (spec.totalInput === 0) {
      w.inProgress = 1;
    } else {
      w.inProgress = spec.finishedInput / spec.totalInput;
    }
  } else if (spec.totalValue === 0) {
    w.finished = 0;
    spec.inProgress = 1;
  } else {
    w.finished = spec.finishedValue / spec.totalValue;
    w.inProgress = spec.inProgressValue / spec.totalValue;
  }
};


workingPackage.methods.updateProgress = function (cb) {
  var works = this.works;
  var totalValue = 0;
  var finishedValue = 0;
  var inProgressValue = 0;
  works.forEach(function (w) {
    totalValue = totalValue + w.value;
    finishedValue = finishedValue + w.value * w.finished;
    inProgressValue = inProgressValue + w.value * w.inProgress;
  });

  this.totalValue = totalValue;
  this.finishedValue = finishedValue;
  this.inProgressValue = inProgressValue;
  if (this.isModified()) {
    this.save(function (err, newPackage) {
      if (cb) {
        cb(err, newPackage);
      } else {
        console.error(err);
      }
    });
  }
};

var WorkingPackage = mongoose.model('WorkingPackage', workingPackage);

module.exports = {
  WorkingPackage: WorkingPackage
};
