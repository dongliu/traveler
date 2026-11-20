const fs = require('fs');
const path = require('path');
const { ROOT } = require('./env');

// Read directly from the running stack's own config (docker/permission.json,
// per TRAVELER_CONFIG_REL_PATH in docker-compose.yml) so tests that assert on
// a role's granted permissions stay correct when that mapping is edited,
// instead of hard-coding a snapshot of it.
function loadPermissionConfig() {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, 'docker', 'permission.json'), 'utf8')
  );
}

function roleGrants(role, permission) {
  const config = loadPermissionConfig();
  return (config[role] || []).includes(permission);
}

module.exports = { loadPermissionConfig, roleGrants };
