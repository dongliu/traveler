var mongoose = require('mongoose');
var appConfig = require('../config/config').app;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;
var cheerio = require('cheerio');
var share = require('./share.js');
var FormError = require('../lib/error').FormError;
var addHistory = require('./history').addHistory;
var addVersion = require('./history').addVersion;

/******
publicAccess := 0 // for read or
        | 1 // for write or
        | -1 // no access
******/
/******
status := 0 // editable draft
        | 0.5 // ready to release
        | 1 // released
        | 2 // archived
******/
// mapping : user-key -> name
// labels : name -> label

var stateTransition = [
  {
    from: 0,
    to: [0.5, 2],
  },
  {
    from: 0.5,
    to: [0, 2],
  },
];

const statusMap = {
  '0': 'draft',
  '0.5': 'submitted for release',
  '1': 'pre released',
  '2': 'archived',
};

var form = new Schema({
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
  var doc = this;
  if (doc.isNew || doc.isModified('html')) {
    let mapping = {};
    let labels = {};
    let $ = cheerio.load(doc.html);
    let inputs = $('input, textarea');
    let lastInputName = '';
    let lastUserkey = '';
    let inputName = '';
    let label = '';
    let userkey = '';
    for (let i = 0; i < inputs.length; i += 1) {
      let input = $(inputs[i]);
      inputName = input.attr('name');
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
                'inconsistent usekey "' +
                  userkey +
                  '"found for the same input name',
                400
              )
            );
          }
        } else {
          return next(
            new FormError('duplicated input name "' + inputName + '"', 400)
          );
        }
      } else {
        labels[inputName] = label;
        // add user key mapping if userkey is not null or empty
        if (userkey) {
          if (mapping.hasOwnProperty(userkey)) {
            return next(
              new FormError('duplicated input userkey "' + userkey + '"', 400)
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
  }
  next();
});

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

var formFile = new Schema({
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

var Form = mongoose.model('Form', form);
var FormFile = mongoose.model('FormFile', formFile);

var createForm = function(json, newFormResultCallBack) {
  var formToCreate = {};
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
  Form: Form,
  FormFile: FormFile,
  stateTransition: stateTransition,
  statusMap: statusMap,
  createForm: createForm,
};
