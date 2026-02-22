const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const MAX_VISIT_HISTORY = 30;

const visit = new Schema({
  location: { type: String, required: true },
  method: { type: String, default: 'GET' },
  visitedOn: { type: Date, default: Date.now },
});

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
  // reviews: [ObjectId],
  subscribe: {
    type: Boolean,
    default: false,
  },
  // might need to enforce a limit on the length of the visit history array
  visits: [visit],
});

user.methods.addVisit = function(location, method = 'GET') {
  const user = this;
  if (user.visits[0]?.location === location) {
    user.visits[0].visitedOn = new Date();
    return;
  }
  const latest = { location, method, visitedOn: new Date() };
  const update = { $push: { visits: { $each: [latest], $position: 0 } } };
  if (user.visits.length >= MAX_VISIT_HISTORY) {
    update.$pop = { visits: 1 };
  }
  return user.update(update).exec();
};

user.methods.back = function() {
  const user = this;
  if (user.visits.length < 2) {
    return null;
  }
  const update = { $pop: { visits: 1 } };
  const backLocation = user.visits[0].location;
  user.update(update).exec();
  return backLocation;
};

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
