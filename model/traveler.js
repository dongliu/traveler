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

var form = new Schema({
  html: String
});


/*******
status := 0 // working
        | 1 // completed
        | 2 // frozen
*******/

var traveler = new Schema({
  title: String,
  description: String,
  devices: [String],
  status: Number,
  createdBy: String,
  createdOn: Date,
  updatedBy: String,
  updatedOn: Date,
  sharedWith: [sharedWithUser],
  referenceForm: ObjectId,
  forms: [form],
  data: [ObjectId],
  comments: [ObjectId]
});


var travelerData = new Schema({
  traveler: ObjectId,
  name: String,
  value: Schema.Types.Mixed,
  inputBy: String,
  inputOn: Date
});

var travelerComment = new Schema({
  traveler: ObjectId,
  name: String,
  value: String,
  inputBy: String,
  inputOn: Date
});


var Traveler = mongoose.model('Traveler', traveler);
var TravelerData = mongoose.model('TravelerData', travelerData);
var TravelerComment = mongoose.model('TravelerComment', travelerComment);

module.exports = {
  Traveler: Traveler,
  TravelerData: TravelerData,
  TravelerComment: TravelerComment
};