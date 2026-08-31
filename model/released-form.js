const mongoose = require('mongoose');

const { Schema } = mongoose;
const { addHistory } = require('./history');
const { addVersion } = require('./history');

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
  title: String,
  html: String,
  mapping: Schema.Types.Mixed,
  labels: Schema.Types.Mixed,
  types: Schema.Types.Mixed,
  formType: {
    type: String,
    default: 'normal',
    enum: ['normal', 'discrepancy', 'ACL'],
  },
  _v: Number,
});

/**
 * formType:
 * normal => has only base, base is a normal released form
 * discrepancy => has only base, base is a discrepancy released form
 * normal_discrepancy => has a base and a discrepancy form
 * ACL => has only base, base is an ACL released form
 * normal_acl => has a base and zero-to-many ACL forms, produced by composing
 *   already-released forms (see /released-forms/:id/compose)
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
    enum: ['normal', 'discrepancy', 'normal_discrepancy', 'ACL', 'normal_acl'],
  },
  archivedOn: Date,
  archivedBy: String,
  base: formContent,
  discrepancy: { type: formContent, default: null },
  aclForms: { type: [formContent], default: [] },
  // ver format:
  //   normal / discrepancy / normal_discrepancy: base_v[:discrepancy_v]
  //   normal_acl: "base: <base ver>[, acl: <acl ver>[, <acl ver>...]]"
  //     (human-readable display only; see compositionKey for the
  //     duplicate-detection key, since ACL forms can share a version number)
  ver: String,
  // normal_acl only: "<base released form id>[:<sorted acl released form ids>]"
  // used to detect duplicate compositions; not displayed to users
  compositionKey: String,
});

releasedForm.plugin(addVersion, {
  fieldsToVersion: ['title', 'description', 'base', 'discrepancy', 'aclForms'],
});

releasedForm.plugin(addHistory, {
  fieldsToWatch: [
    'title',
    'description',
    'tags',
    'status',
    'base',
    'discrepancy',
    'aclForms',
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
