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

var task = new Schema({
  traveler: ObjectId,
  addedOn: Date,
  addedBy: String,
  priority: {
    type: number,
    min: 1,
    max: 10,
    default: 5
  },
  color: String
});

var package = new Schema({
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
  tasks: [task],
  archived: {
    type: Boolean,
    default: false
  }
});

var Package = mongoose.model('Package', package);

module.exports = {
  Package: Package
};
