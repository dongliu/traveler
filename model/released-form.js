const mongoose = require('mongoose');

const { Schema } = mongoose;
const { addHistory } = require('./history');
const { addVersion } = require('./history');
const { attachReview } = require('./review');

/*
status := 1 // released
        | 2 // archived
*/

const stateTransition = [
  {
    from: 1,
    to: [2],
  },
];

const statusMap = {
  '1': 'released',
  '2': 'archived',
};

const formContent = new Schema({
  // _id is the form _id
  createdBy: { type: String, ref: 'User' },
  html: String,
  mapping: Schema.Types.Mixed,
  labels: Schema.Types.Mixed,
  types: Schema.Types.Mixed,
  formType: {
    type: String,
    default: 'normal',
    enum: ['normal', 'discrepancy'],
  },
  _v: Number,
});

/**
 * formType:
 * normal => has only base, base is a normal released form
 * discrepancy => has only base, base is a discrepancy released form
 * normal_discrepancy => has a base and a discrepancy form
 */
const releasedForm = new Schema({
  title: String,
  description: String,
  releasedBy: { type: String, ref: 'User' },
  releasedOn: Date,
  tags: [String],
  status: {
    type: Number,
    default: 1,
  },
  formType: {
    type: String,
    default: 'normal',
    enum: ['normal', 'discrepancy', 'normal_discrepancy'],
  },
  archivedOn: Date,
  archivedBy: { type: String, ref: 'User' },
  base: formContent,
  discrepancy: { type: formContent, default: null },
  // ver format: base_v[:discrepancy_v]
  ver: String,
  documentNumber: String,
});

releasedForm.plugin(attachReview);

releasedForm.plugin(addVersion, {
  fieldsToVersion: ['title', 'description', 'base', 'discrepancy'],
});

releasedForm.plugin(addHistory, {
  fieldsToWatch: [
    'title',
    'description',
    'tags',
    'status',
    'base',
    'discrepancy',
    '_v',
  ],
});

const ReleasedForm = mongoose.model('ReleasedForm', releasedForm);

// FormContent is not for persistence
const FormContent = mongoose.model('FormContent', formContent);

module.exports = {
  ReleasedForm,
  stateTransition,
  FormContent,
  statusMap,
};
