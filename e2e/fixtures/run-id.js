const crypto = require('crypto');

function runId() {
  return `e2e-${Date.now().toString(36)}-${crypto
    .randomBytes(3)
    .toString('hex')}`;
}

module.exports = { runId };
