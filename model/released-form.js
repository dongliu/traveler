const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

/******
status := 1 // released
        | 2 // archived
******/

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
  html: String,
  mapping: Schema.Types.Mixed,
  labels: Schema.Types.Mixed,
  reference: ObjectId,
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
  releasedBy: String,
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
  archivedBy: String,
  base: formContent,
  discrepancy: { type: formContent, default: null },
  // format: base_v[:discrepancy_v]
  ver: String,
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
