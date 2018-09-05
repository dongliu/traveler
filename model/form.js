var mongoose = require('mongoose');
var appConfig = require('../config/config').app;
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;
var cheerio = require('cheerio');
var share = require('./share.js');
var FormError = require('../lib/error').FormError;

/******
publicAccess := 0 // for read or
        | 1 // for write or
        | -1 // no access
******/
/******
status := 0 // editable
        | 0.5 // ready to publish
        | 1 // published
        | 2 // obsoleted
******/
// mapping : user-key -> name

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
    default: 0
  },
  transferredOn: Date,
  archivedOn: Date,
  archived: {
    type: Boolean,
    default: false
  },
  publicAccess: {
    type: Number,
    default: appConfig.default_form_public_access
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  mapping: Schema.Types.Mixed,
  html: String
});

/**
 * pre save middleware to add or update the mapping
 * and validate unique input name and data-userkey
 */
form.pre('save', function (next) {
  var doc = this;
  if (doc.isNew || doc.isModified('html')) {
    let mapping = {};
    let $ = cheerio.load(doc.html);
    let inputs = $('input, textarea');
    let lastInputName = '';
    let lastUserkey = '';
    let inputName = '';
    let userkey = '';
    for (let i = 0; i < inputs.length; i += 1) {
      let input = $(inputs[i]);
      inputName = input.attr('name');
      userkey = input.attr('data-userkey');
      if (userkey && inputName) {
        userkey = userkey.trim();
        inputName = inputName.trim();
      }
      if (!userkey || !inputName) {
        continue;
      }
      if (lastInputName === inputName) {
        if (input.attr('type') === 'radio') {
          // consistent name -> userkey
          if (userkey === lastUserkey) {
            continue;
          } else {
            return next(new FormError('inconsistent usekey "' + userkey + '"found for the same input name', 400));
          }
        } else {
          return next(new FormError('duplicated input name "' + inputName + '"', 400));
        }
      } else {
        // add the mapping
        if (mapping.hasOwnProperty(userkey)) {
          return next(new FormError('duplicated input userkey "' + userkey + '"', 400));
        }
        mapping[userkey] = inputName;
      }
      lastInputName = inputName;
      lastUserkey = userkey;
    }
    this.mapping = mapping;
  }
  next();
});

var formFile = new Schema({
  form: ObjectId,
  value: String,
  inputType: String,
  file: {
    path: String,
    encoding: String,
    mimetype: String
  },
  uploadedBy: String,
  uploadedOn: Date
});

var Form = mongoose.model('Form', form);
var FormFile = mongoose.model('FormFile', formFile);

module.exports = {
  Form: Form,
  FormFile: FormFile
};
