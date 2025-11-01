/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');
const appConfig = require('../config/config').app;

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const share = require('./share');
const logger = require('../lib/loggers').getLogger();

/**
 * finished is the percentage of value that is completed.
 * inProgress is the percentage of value that is still in progress.
 * If status === 2, then finished = 100, and inProgress = 0;
 * If status === 0, then finished = 0, and inProgress = 0;
 * finished and inProgress are cached status.
 * totalSteps and finishedSteps are cached status.
 * They should be updated when the reference traveler is loaded.
 */

const work = new Schema({
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

const binder = new Schema({
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
});

const progressFields = [
  'status',
  'finishedInput',
  'totalInput',
  'finishedValue',
  'inProgressValue',
  'totalValue',
  'finishedWork',
  'inProgressWork',
  'totalWork',
];

function updateInputProgress(w, spec) {
  w.totalInput = spec.totalInput;
  w.finishedInput = spec.finishedInput;
}

// update work status according to spec, but not saved
binder.methods.updateWorkProgress = function(spec) {
  const w = this.works.id(spec._id);
  if (!w) {
    logger.warn(`no work _id ${spec._id} in binder ${this._id}`);
    return;
  }
  updateInputProgress(w, spec);
  if (w.status !== spec.status) {
    w.status = spec.status;
  }
  // same for traveler or binder
  if (spec.status === 2) {
    w.finished = 1;
    w.inProgress = 0;
    return;
  }

  // only apply to traveler work
  if (spec.status === 0 && w.refType === 'traveler') {
    w.finished = 0;
    w.inProgress = 0;
    return;
  }

  // active traveler
  if (w.refType === 'traveler') {
    work.finished = 0;
    if (spec.totalInput === 0) {
      w.inProgress = 1;
    } else {
      w.inProgress = spec.finishedInput / spec.totalInput;
    }
    return;
  }
  //  new or active binder
  if (spec.totalValue === 0) {
    w.finished = 0;
    w.inProgress = 1;
  } else {
    w.finished = spec.finishedValue / spec.totalValue;
    w.inProgress = spec.inProgressValue / spec.totalValue;
  }
};

// update binder status and save
binder.methods.updateProgress = function(cb) {
  const { works } = this;
  let totalValue = 0;
  let finishedValue = 0;
  let inProgressValue = 0;
  let totalWork = 0;
  let finishedWork = 0;
  let inProgressWork = 0;
  let totalInput = 0;
  let finishedInput = 0;
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
        cb(err, newBinder);
      }
      if (err) {
        logger.error(err);
      }
    });
  }
};

/**
 * update the progress of binders that include this binder
 * @param  {Binder} child the binder document
 * @return {undefined}
 */
function updateParentProgress(child) {
  Binder.find({
    status: {
      $ne: 3,
    },
    works: {
      $elemMatch: {
        _id: child._id,
      },
    },
  }).exec(function(err, binders) {
    if (err) {
      return logger.error(
        `cannot find binders for traveler ${child._id}, error: ${err.message}`
      );
    }
    binders.forEach(function(b) {
      b.updateWorkProgress(child);
      b.updateProgress();
    });
  });
}

binder.pre('save', function(next) {
  const modifiedPaths = this.modifiedPaths();
  // keep it so that we can refer at post save
  this.wasModifiedPaths = modifiedPaths;
  next();
});

binder.post('save', function(obj) {
  const modifiedPaths = this.wasModifiedPaths;
  const updateParent = modifiedPaths.some(
    m => progressFields.indexOf(m) !== -1
  );
  if (updateParent) {
    updateParentProgress(obj);
  }
});

const Binder = mongoose.model('Binder', binder);

module.exports = {
  Binder,
};
