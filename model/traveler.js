/*jslint es5: true*/

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;

var share = require('./share.js');

var form = new Schema({
  html: String
});


/*******
status := 0 // new
        | 1 // active
        | 1.5 // complete request
        | 2 // completed
        | 3 // frozen
*******/

/******
publicAccess := 0 // for read or
        | 1 // for write or
        | -1 // no access
******/

var traveler = new Schema({
  title: String,
  description: String,
  devices: [String],
  location: String,
  manPower: [String],
  status: Number,
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
    default: 0
  },
  sharedWith: [share.user],
  sharedGroup: [share.group],
  referenceForm: ObjectId,
  forms: [form],
  activeForm: {
    type: Number,
    default: 0
  },
  data: [ObjectId],
  notes: [ObjectId],
  totalInput: Number,
  finishedInput: Number,
  archived: {
    type: Boolean,
    default: false
  }
});

/*******
type := 'file'
      | 'text'
      | 'textarea'
      | 'number'
*******/

var travelerData = new Schema({
  traveler: ObjectId,
  name: String,
  value: Schema.Types.Mixed,
  file: {
    path: String,
    encoding: String,
    mimetype: String
  },
  inputType: String,
  inputBy: String,
  inputOn: Date
});

var travelerNote = new Schema({
  traveler: ObjectId,
  name: String,
  value: String,
  inputBy: String,
  inputOn: Date
});


var Traveler = mongoose.model('Traveler', traveler);
var TravelerData = mongoose.model('TravelerData', travelerData);
var TravelerNote = mongoose.model('TravelerNote', travelerNote);

module.exports = {
  Traveler: Traveler,
  TravelerData: TravelerData,
  TravelerNote: TravelerNote
};
