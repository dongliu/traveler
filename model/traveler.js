/* jslint es5: true */

const mongoose = require('mongoose');
const appConfig = require('../config/config').app;

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const share = require('./share');
const { DataError } = require('../lib/error');

require('./binder');

const Binder = mongoose.model('Binder');

const TIME_PART_REG_EX = '([0-1][0-9]|2[0-4]):([0-5][0-9])';
const TIME_REG_EX = `^${TIME_PART_REG_EX}$`;
const DATE_REG_EX_START = '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])';
const DATE_REG_EX = `${DATE_REG_EX_START}$`;
const DATETIME_REG_EX = `${DATE_REG_EX_START}T${TIME_PART_REG_EX}$`;

/**
 * A form can become active, inactive, and reactive. The form's activated date
 *   and the form's updated data can tell if the form has been updated since
 *   it is used by the traveler.
 * activatedOn: the dates when this form starts to be active
 * alias : a name for convenience to distinguish forms.
 * mapping : user-key -> name
 * labels: name -> label
 * types: name -> input types
 * inputs : list of input names in the form
 * Mapping and inputs are decided by the form snapshot when a traveler is
 * created from it. They are within form because they will be never changed once
 * created.
 */

const form = new Schema({
  html: String,
  mapping: Schema.Types.Mixed,
  labels: Schema.Types.Mixed,
  // list of input names in the current active form
  // do not need this because of labels
  // inputs: [String],
  activatedOn: [Date],
  reference: ObjectId,
  _v: Number,
  alias: String,
});

const user = new Schema({
  _id: String,
  username: String,
});

const logData = new Schema({
  name: String,
  value: Schema.Types.Mixed,
  file: {
    path: String,
    encoding: String,
    mimetype: String,
  },
});

// a log is an array of log data collected in a form.
// the data is submitted in one request, which is different from traveler data.
const log = new Schema({
  referenceForm: { type: ObjectId, ref: 'Form' },
  records: [logData],
  inputBy: String,
  inputOn: Date,
});

/**
 * status := 0 // new
 *         | 1 // active
 *         | 1.5 // complete request
 *         | 2 // completed
 *         | 3 // frozen
 *         | 4 // archived
 */

const statusMap = {
  '0': 'initialized',
  '1': 'active',
  '1.5': 'submitted for completion',
  '2': 'completed',
  '3': 'frozen',
  '4': 'archived',
};

const stateTransition = [
  {
    from: 0,
    to: [1, 4],
  },
  {
    from: 1,
    to: [1.5, 3, 4],
  },
  {
    from: 1.5,
    to: [1, 2],
  },
  {
    from: 2,
    to: [4, 1],
  },
  {
    from: 3,
    to: [1],
  },
];

/**
 * publicAccess := 0 // for read or
 *               | 1 // for write or
 *               | -1 // no access
 */

const traveler = new Schema({
  title: String,
  description: String,
  devices: [String],
  locations: [String],
  manPower: [user],
  status: {
    type: Number,
    default: 0,
  },
  createdBy: String,
  createdOn: Date,
  clonedBy: String,
  clonedFrom: ObjectId,
  updatedBy: String,
  updatedOn: Date,
  archivedOn: Date,
  owner: String,
  tags: [String],
  transferredOn: Date,
  deadline: Date,
  publicAccess: {
    type: Number,
    default: appConfig.default_traveler_public_access,
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  // global object id of the active form
  referenceForm: ObjectId,
  // global object if of the discrepancy form
  referenceDiscrepancyForm: ObjectId,
  referenceReleasedForm: ObjectId,
  referenceReleasedFormVer: String,
  forms: [form],
  discrepancyForms: [form],
  mapping: Schema.Types.Mixed,
  labels: Schema.Types.Mixed,
  types: Schema.Types.Mixed,
  // local id of active form in forms
  activeForm: String,
  // local id of the active discrepancy form in discrepancyForms
  activeDiscrepancyForm: String,
  // array of logs
  discrepancyLogs: [{ type: ObjectId, ref: 'Log' }],
  data: [ObjectId],
  notes: [ObjectId],
  // decided by the active form input list
  // update with active form
  totalInput: {
    type: Number,
    default: 0,
    min: 0,
  },
  // decided by the touched inputs
  // keep for compatibility with previous versions
  finishedInput: {
    type: Number,
    default: 0,
    min: 0,
  },
  // list of inputs that have been touched accoring to the active form
  // update with traveler data and active form
  touchedInputs: [String],
  archived: {
    type: Boolean,
    default: false,
  },
});

/**
 * update the progress of binders that inlude this traveler document
 * @param  {Traveler} travelerDoc the traveler document
 * @return {undefined}
 */
function updateBinderProgress(travelerDoc) {
  Binder.find({
    archived: {
      $ne: true,
    },
    works: {
      $elemMatch: {
        _id: travelerDoc._id,
      },
    },
  }).exec(function(err, binders) {
    if (err) {
      return console.error(
        `cannot find binders for traveler ${travelerDoc._id}, error: ${err.message}`
      );
    }
    return binders.forEach(function(binder) {
      binder.updateWorkProgress(travelerDoc);
      binder.updateProgress();
    });
  });
}

traveler.pre('save', function(next) {
  const modifiedPaths = this.modifiedPaths();
  // keep it so that we can refer at post save
  this.wasModifiedPaths = modifiedPaths;
  next();
});

traveler.post('save', function(obj) {
  const modifiedPaths = this.wasModifiedPaths;
  if (
    modifiedPaths.indexOf('totalInput') !== -1 ||
    modifiedPaths.indexOf('finishedInput') !== -1 ||
    modifiedPaths.indexOf('status') !== -1
  ) {
    updateBinderProgress(obj);
  }
});

/**
 * type := 'file'
 *       | 'text'
 *       | 'textarea'
 *       | 'number'
 */

const travelerData = new Schema({
  traveler: ObjectId,
  name: String,
  value: Schema.Types.Mixed,
  file: {
    path: String,
    encoding: String,
    mimetype: String,
  },
  inputType: String,
  inputBy: String,
  inputOn: Date,
});

travelerData.pre('save', function validateNumber(next) {
  if (this.inputType === 'number' && typeof this.value !== 'number') {
    return next(new DataError(`value "${this.value}" is not a number`, 400));
  }

  if (
    this.inputType === 'checkbox' &&
    (this.value === true || this.value === false) === false
  ) {
    return next(new DataError(`value "${this.value}" is not a boolean`, 400));
  }

  if (
    this.inputType === 'datetime-local' &&
    this.value.match(DATETIME_REG_EX) === null
  ) {
    return next(
      new DataError(`${this.value} does not match format yyyy-mm-ddThh:mm`, 400)
    );
  }

  if (this.inputType === 'date' && this.value.match(DATE_REG_EX) === null) {
    return next(
      new DataError(`${this.value} does not match format yyyy-mm-dd`, 400)
    );
  }

  if (this.inputType === 'time' && this.value.match(TIME_REG_EX) === null) {
    return next(
      new DataError(`${this.value} does not match format hh:mm`, 400)
    );
  } // url

  return next();
});

const travelerNote = new Schema({
  traveler: ObjectId,
  name: String,
  value: String,
  inputBy: String,
  inputOn: Date,
});

const Traveler = mongoose.model('Traveler', traveler);
const TravelerData = mongoose.model('TravelerData', travelerData);
const TravelerNote = mongoose.model('TravelerNote', travelerNote);
const Log = mongoose.model('Log', log);

module.exports = {
  Traveler,
  TravelerData,
  TravelerNote,
  Log,
  statusMap,
  stateTransition,
};
