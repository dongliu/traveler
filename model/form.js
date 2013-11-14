var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// access: 0 for read and 1 for write
var form = new Schema({
  title: String,
  createdBy: String,
  createdOn: Date,
  updatedBy: String,
  updatedOn: Date,
  sharedWith: [{
    userid: String,
    username: String,
    access: Number
  }],
  html: String
});

var Form = mongoose.model('Form', form);

module.exports = {
  Form: Form
};