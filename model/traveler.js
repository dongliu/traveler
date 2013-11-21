var mongoose = require('mongoose');
var Schema = mongoose.Schema;

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
  sharedWith: [{
    userid: String,
    username: String,
    access: Number
  }],
  forms: [{version: Number, description: String, html: String}],
  data: [String],
  comments: [String]
});


var travelerData = new Schema({
  name: String,
  value: Schema.Types.Mixed,
  inputBy: String,
  inputOn: Date
});

var travelerComment = new Schema({
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