/*jslint es5: true*/

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var share = require('./share.js');

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


var form = new Schema({
  title: String,
  createdBy: String,
  createdOn: Date,
  clonedFrom: ObjectId,
  updatedBy: String,
  updatedOn: Date,
  owner: String,
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
    default: -1
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  html: String
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
