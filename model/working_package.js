/*jslint es5: true*/

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var share = require('./share.js');

var work = new Schema({
  traveler: ObjectId,
  workingPackage: ObjectId,
  addedOn: Date,
  addedBy: String,
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  sequence: {
    type: Number,
    min: 1,
    defualt: 1
  },
  color: String
});

/******
publicAccess := 0 // for read or
        | 1 // for write or
        | -1 // no access
******/

var workingPackage = new Schema({
  title: String,
  description: String,
  tags: [String],
  createdBy: String,
  createdOn: Date,
  clonedBy: String,
  clonedFrom: ObjectId,
  updatedBy: String,
  updatedOn: Date,
  archivedOn: Date,
  owner: String,
  transferredOn: Date,
  deadline: Date,
  publicAccess: {
    type: Number,
    default: -1
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  works: [ObjectId],
  finishedWorks: Number,
  archived: {
    type: Boolean,
    default: false
  }
});

var Work = mongoose.model('Work', work);
var WorkingPackage = mongoose.model('WorkingPackage', workingPackage);

module.exports = {
  Work: Work,
  WorkingPackage: WorkingPackage
};
