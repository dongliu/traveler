const config = require('../config/config');

const WBS_NUMBER_PATTERN = /^[^.]+(\.[^.]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidWbsNumber(wbsNumber) {
  return typeof wbsNumber === 'string' && WBS_NUMBER_PATTERN.test(wbsNumber);
}

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_PATTERN.test(email);
}

function listEntries() {
  const wbsYaml = config.wbsYaml || {};
  return Object.entries(wbsYaml)
    .map(([wbs_number, notification_email]) => ({ wbs_number, notification_email, source: 'config' }))
    .sort((a, b) => a.wbs_number.localeCompare(b.wbs_number));
}

// Resolves a WBS number to the nearest matching entry in the YAML map: an
// exact match if one exists, otherwise the nearest registered ancestor (more
// segments = nearer), otherwise null.
function resolveWbsContact(wbsNumber) {
  if (!wbsNumber) return null;
  const trimmed = String(wbsNumber).trim();
  if (!trimmed) return null;

  const wbsYaml = config.wbsYaml || {};

  let current = trimmed;
  while (current) {
    if (wbsYaml[current] !== undefined) {
      return { wbs_number: current, notification_email: wbsYaml[current], source: 'config' };
    }
    const lastDot = current.lastIndexOf('.');
    if (lastDot === -1) break;
    current = current.slice(0, lastDot);
  }
  return null;
}

module.exports = {
  isValidWbsNumber,
  isValidEmail,
  listEntries,
  resolveWbsContact,
};
