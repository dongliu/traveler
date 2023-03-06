const mongoose = require('mongoose');
const cheerio = require('cheerio');
const appConfig = require('../config/config').app;

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;
const share = require('./share');
const { FormError } = require('../lib/error');
const { addHistory } = require('./history');
const { addVersion } = require('./history');
const { addReview } = require('./review');

/** ****
publicAccess := 0 // for read or
        | 1 // for write or
        | -1 // no access
***** */
/** ****
status := 0 // editable draft
        | 0.5 // submitted for reviewing
        | 1 // review finished and all approved and released
        | 2 // archived
***** */
// mapping : user-key -> name
// labels : name -> label
// types: name -> input type

const stateTransition = [
  {
    from: 0,
    to: [0.5, 2],
  },
  {
    from: 0.5,
    to: [0, 1, 2],
  },
  // do not archive approved forms
  // {
  //   from: 1,
  //   to: [2],
  // },
];

const statusMap = {
  '0': 'draft',
  '0.5': 'submitted for review',
  '1': 'approved and released',
  '2': 'archived',
};

const form = new Schema({
  title: String,
  description: String,
  createdBy: String,
  createdOn: Date,
  clonedFrom: ObjectId,
  updatedBy: String,
  updatedOn: Date,
  owner: String,
  tags: [String],
  status: {
    type: Number,
    default: 0,
  },
  transferredOn: Date,
  archivedOn: Date,
  archived: {
    type: Boolean,
    default: false,
  },
  publicAccess: {
    type: Number,
    default: appConfig.default_form_public_access,
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  mapping: Schema.Types.Mixed,
  labels: Schema.Types.Mixed,
  types: Schema.Types.Mixed,
  html: String,
  formType: {
    type: String,
    default: 'normal',
    enum: ['normal', 'discrepancy'],
  },
});

/**
 * pre save middleware to add or update the mapping
 * and validate unique input name and data-userkey
 */
form.pre('save', function(next) {
  const doc = this;
  if (doc.isNew || doc.isModified('html')) {
    const mapping = {};
    const labels = {};
    const types = {};
    const $ = cheerio.load(doc.html);
    const inputs = $('input, textarea');
    let lastInputName = '';
    let lastUserkey = '';
    let inputName = '';
    let label = '';
    let userkey = '';
    let inputType = '';
    for (let i = 0; i < inputs.length; i += 1) {
      const input = $(inputs[i]);
      inputName = input.attr('name');
      inputType = input.attr('type');
      label = input
        .closest('.control-group')
        .children('.control-label')
        .children('span.model-label')
        .text();
      userkey = input.attr('data-userkey');
      if (inputName) {
        inputName = inputName.trim();
      }
      if (label) {
        label = label.trim();
      }
      if (userkey) {
        userkey = userkey.trim();
      }

      if (!inputName) {
        continue;
      }
      // seen the same input name already
      if (lastInputName === inputName) {
        // only radio inputs share the same input name
        if (input.attr('type') === 'radio') {
          // consistent name -> userkey
          if (userkey === lastUserkey) {
            continue;
          } else {
            return next(
              new FormError(
                `inconsistent usekey "${userkey}"found for the same input name`,
                400
              )
            );
          }
        } else {
          return next(
            new FormError(`duplicated input name "${inputName}"`, 400)
          );
        }
      } else {
        labels[inputName] = label;
        types[inputName] = inputType;
        // add user key mapping if userkey is not null or empty
        if (userkey) {
          if (mapping.hasOwnProperty(userkey)) {
            return next(
              new FormError(`duplicated input userkey "${userkey}"`, 400)
            );
          }
          mapping[userkey] = inputName;
        }
      }
      lastInputName = inputName;
      lastUserkey = userkey;
    }
    doc.mapping = mapping;
    doc.labels = labels;
    doc.types = types;
  }
  return next();
});

/**
 * Check if a form should be rendered in builder
 * @returns true if rendered in builder view, other wise false
 */
form.methods.isBuilder = function() {
  const doc = this;
  return [0, 0.5, 1].includes(doc.status);
};

form.plugin(addVersion, {
  fieldsToVersion: ['title', 'description', 'html'],
});

form.plugin(addHistory, {
  fieldsToWatch: [
    'title',
    'description',
    'owner',
    'status',
    'createdBy',
    'publicAccess',
    'html',
    '_v',
  ],
});

form.plugin(addReview);

const formFile = new Schema({
  form: ObjectId,
  value: String,
  inputType: String,
  file: {
    path: String,
    encoding: String,
    mimetype: String,
  },
  uploadedBy: String,
  uploadedOn: Date,
});

const Form = mongoose.model('Form', form);
const FormFile = mongoose.model('FormFile', formFile);

const createForm = function(json, newFormResultCallBack) {
  const formToCreate = {};
  formToCreate.title = json.title;
  formToCreate.createdBy = json.createdBy;
  formToCreate.createdOn = Date.now();
  formToCreate.updatedBy = json.createdBy;
  formToCreate.updatedOn = Date.now();
  formToCreate.html = json.html || '';
  formToCreate.formType = json.formType || 'normal';
  formToCreate.sharedWith = [];
  new Form(formToCreate).save(newFormResultCallBack);
};

module.exports = {
  Form,
  FormFile,
  stateTransition,
  statusMap,
  createForm,
};
