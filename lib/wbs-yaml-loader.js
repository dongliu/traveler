const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const loggers = require('./loggers');

// Same patterns as wbs-notification-service.js — kept here to avoid a circular
// dependency (config.js → this file → wbs-notification-service.js → config.js).
const WBS_NUMBER_PATTERN = /^[^.]+(\.[^.]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidWbsNumber(v) {
  return typeof v === 'string' && WBS_NUMBER_PATTERN.test(v);
}
function isValidEmail(v) {
  return typeof v === 'string' && EMAIL_PATTERN.test(v);
}

function loadWbsYaml(configPath) {
  const logger = loggers.getLogger();
  const filePath = path.resolve(configPath, 'wbs.yaml');
  let content;

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.debug(`[wbs-yaml] wbs.yaml not found at ${filePath} — skipping`);
    } else {
      logger.error(`[wbs-yaml] Could not read ${filePath}: ${err.message}`);
    }
    return {};
  }

  let parsed;
  try {
    parsed = yaml.load(content, { schema: yaml.FAILSAFE_SCHEMA });
  } catch (err) {
    logger.error(`[wbs-yaml] Failed to parse ${filePath}: ${err.message}`);
    return {};
  }

  if (parsed === null || parsed === undefined) {
    return {};
  }

  const result = {};
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    const wbsNumber = String(rawKey).trim();
    const email = String(rawValue).trim();

    if (!isValidWbsNumber(wbsNumber)) {
      logger.warn(`[wbs-yaml] Skipping entry "${rawKey}": invalid WBS number "${wbsNumber}"`);
      continue;
    }
    if (!isValidEmail(email)) {
      logger.warn(`[wbs-yaml] Skipping entry "${rawKey}": invalid email "${email}"`);
      continue;
    }
    result[wbsNumber] = email;
  }

  const count = Object.keys(result).length;
  if (count > 0) {
    logger.info(`[wbs-yaml] Loaded ${count} WBS notification mapping(s) from wbs.yaml`);
  }
  return result;
}

module.exports = { loadWbsYaml };
