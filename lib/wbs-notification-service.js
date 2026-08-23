const { WbsNotification } = require('../model/wbs-notification');

const WBS_NUMBER_PATTERN = /^[^.]+(\.[^.]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidWbsNumber(wbsNumber) {
  return typeof wbsNumber === 'string' && WBS_NUMBER_PATTERN.test(wbsNumber);
}

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_PATTERN.test(email);
}

async function listEntries() {
  return WbsNotification.find({}).sort({ wbs_number: 1 }).lean();
}

async function addEntry(data, user) {
  const wbsNumber = typeof data.wbs_number === 'string' ? data.wbs_number.trim() : data.wbs_number;
  const email = typeof data.notification_email === 'string' ? data.notification_email.trim() : data.notification_email;

  if (!isValidWbsNumber(wbsNumber)) {
    const err = new Error(
      "WBS number must be one or more non-empty segments separated by single '.' characters"
    );
    err.status = 400;
    throw err;
  }
  if (!isValidEmail(email)) {
    const err = new Error('notification_email must be a syntactically valid email address');
    err.status = 400;
    throw err;
  }

  const existing = await WbsNotification.findOne({ wbs_number: wbsNumber }).lean();
  if (existing) {
    const err = new Error(`WBS number already exists in the registry: ${wbsNumber}`);
    err.status = 409;
    throw err;
  }

  const now = new Date();
  const entry = new WbsNotification({
    wbs_number: wbsNumber,
    notification_email: email,
    created_by: user.id,
    created_by_name: user.name,
    updated_by: user.id,
    updated_by_name: user.name,
    created_at: now,
    updated_at: now,
  });

  await entry.save();
  return entry.toObject();
}

async function updateEntry(wbsNumber, data, user) {
  const entry = await WbsNotification.findOne({ wbs_number: wbsNumber });
  if (!entry) {
    const err = new Error(`WBS number not found in registry: ${wbsNumber}`);
    err.status = 404;
    throw err;
  }

  const email = typeof data.notification_email === 'string' ? data.notification_email.trim() : data.notification_email;
  if (!isValidEmail(email)) {
    const err = new Error('notification_email must be a syntactically valid email address');
    err.status = 400;
    throw err;
  }

  entry.notification_email = email;
  entry.updated_by = user.id;
  entry.updated_by_name = user.name;
  entry.updated_at = new Date();

  await entry.save();
  return entry.toObject();
}

async function removeEntry(wbsNumber) {
  const result = await WbsNotification.findOneAndDelete({ wbs_number: wbsNumber });
  if (!result) {
    const err = new Error(`WBS number not found in registry: ${wbsNumber}`);
    err.status = 404;
    throw err;
  }
  return result.toObject();
}

module.exports = {
  isValidWbsNumber,
  isValidEmail,
  listEntries,
  addEntry,
  updateEntry,
  removeEntry,
};
