var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/******
access := 0 // for read or
        | 1 // for write or
        | -1 // no access
******/
var sharedWithUser = new Schema({
  _id: String,
  username: String,
  access: Number,
});

var sharedWithGroup = new Schema({
  _id: String,
  groupname: String,
  access: Number,
});

module.exports = {
  user: sharedWithUser,
  group: sharedWithGroup,
};
