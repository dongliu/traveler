const mongoose = require('mongoose');

const { Schema } = mongoose;

const WbsNotificationSchema = new Schema({
  wbs_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  notification_email: {
    type: String,
    required: true,
    trim: true,
  },

  created_by: String,
  created_by_name: String,
  updated_by: String,
  updated_by_name: String,

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const WbsNotification = mongoose.model('WbsNotification', WbsNotificationSchema);

module.exports = { WbsNotification };
