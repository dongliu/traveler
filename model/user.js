const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const debug = require('debug')('traveler:model:user');

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

user.methods.addVisit = async function(location, method = 'GET') {
  const user = this;
  debug(
    `User ${
      user._id
    } visits ${location} with method ${method}, current visit history: ${user.visits
      .map(v => v.location)
      .join(', ')}`
  );
  const length = user.visits.length;
  if (user.visits[length - 1]?.location === location) {
    user.visits[length - 1].visitedOn = new Date();
    await user.save();
    return;
  }
  const latest = { location, method, visitedOn: new Date() };
  const update = { $push: { visits: { $each: [latest] } } };
  if (user.visits.length >= MAX_VISIT_HISTORY) {
    update.$push.visits.$slice = -MAX_VISIT_HISTORY;
  }
  await user.updateOne(update).exec();
  debug(
    `Visit history after update: ${user.visits.map(v => v.location).join(', ')}`
  );
};

user.methods.back = async function() {
  const user = this;
  debug(
    `User ${
      user._id
    } tries to go back, current visit history: ${user.visits
      .map(v => v.location)
      .join(', ')}`
  );
  const length = user.visits.length;
  if (length < 2) {
    return null;
  }
  const backLocation = user.visits[length - 2].location;
  const update = { $pop: { visits: 1 } };
  await user.updateOne(update).exec();
  debug(
    `User ${
      user._id
    } goes back to ${backLocation}, current visit history: ${user.visits
      .map(v => v.location)
      .join(', ')}`
  );
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
