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
  // no enum constraint here (relaxed for backward compatibility) - routes/user.js's
  // PUT /users/:id is responsible for filtering roles input to the assignable
  // roles (lib/role.js's Roles). 'user' is an implicit default applied at
  // request time and is never persisted (see lib/auth/index.js).
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
