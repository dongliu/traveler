/*jslint es5: true*/

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;


/******
access := 0 // for read or
        | 1 // for write
******/
var sharedWithUser = new Schema({
  _id: String,
  username: String,
  access: Number
});

var sharedWithGroup = new Schema({
  _id: String,
  groupname: String,
  access: Number
});

var work = new Schema({
  traveler: ObjectId,
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
  deadline: Date,
  sharedWith: [sharedWithUser],
  sharedGroup: [sharedWithGroup],
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
