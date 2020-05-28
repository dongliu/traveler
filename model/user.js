var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var user = new Schema({
  _id: String,
  name: String,
  email: String,
  office: String,
  phone: String,
  mobile: String,
  roles: [String],
  lastVisitedOn: Date,
  forms: [ObjectId],
  travelers: [ObjectId],
  binders: [ObjectId],
  subscribe: {
    type: Boolean,
    default: false,
  },
});

var group = new Schema({
  _id: String,
  name: String,
  deleted: {
    type: Boolean,
    default: false
  },
  members: [{type: String, ref: 'User'}],
  forms: [ObjectId],
  travelers: [ObjectId],
  binders: [ObjectId],
});

var User = mongoose.model('User', user);
var Group = mongoose.model('Group', group);
module.exports = {
  User: User,
  Group: Group,
};
