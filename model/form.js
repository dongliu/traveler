/*global ObjectId:false*/

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

/******
access := 0 // for read or
        | 1 // for write
******/
var sharedWithUser = new Schema({
  _id: String,
  username: String,
  access: Number
});

var form = new Schema({
  title: String,
  createdBy: String,
  createdOn: Date,
  updatedBy: String,
  updatedOn: Date,
  sharedWith: [sharedWithUser],
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
