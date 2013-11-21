var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var user = new Schema({
  _id: String,
  name: String,
  email: String,
  office: String,
  phone: String,
  mobile: String,
  roles: [String],
  lastVisitedOn: Date,
  forms: [String],
  travelers: [String],
  subscribe: {
    type: Boolean,
    default: false
  }
});

var User = mongoose.model('User', user);
module.exports = {
  User: User
};