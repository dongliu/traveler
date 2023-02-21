const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const user = new Schema({
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
  // form reviews
  reviews: [ObjectId],
  subscribe: {
    type: Boolean,
    default: false,
  },
  apiKey: String,
  apiKeyExpiration: Date,
});

const group = new Schema({
  _id: String,
  name: String,
  deleted: {
    type: Boolean,
    default: false,
  },
  members: [{ type: String, ref: 'User' }],
  forms: [ObjectId],
  travelers: [ObjectId],
  binders: [ObjectId],
});

const User = mongoose.model('User', user);
const Group = mongoose.model('Group', group);
module.exports = {
  User,
  Group,
};
