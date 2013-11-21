var mongoose = require('mongoose');
var Schema = mongoose.Schema;

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


var Form = mongoose.model('Form', form);

module.exports = {
  Form: Form
};