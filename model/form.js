var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var form = new Schema({
  derivedFrom: String,
  createdBy: String,
  createdOn: Date,
  updatedBy: String,
  updatedOn: Date,
  read: [String],
  write: [String],
  html: String
});

var Form = mongoose.model('Form', form);

module.exports = {
  Form: Form
};