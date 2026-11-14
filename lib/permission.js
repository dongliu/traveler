/**
 * All permissions are defined here. Which roles grant which permissions is
 * controlled entirely by the config.permission mapping (role -> permission
 * list), never by this file - this file only names the valid permissions.
 */
const config = require('../config/config.js');

const Read_all_forms = 'read_all_forms';
const Write_active_travelers = 'write_active_travelers';
const Review_forms = 'review_forms';
const Approve_travelers = 'approve_travelers';
const Manage_users = 'manage_users';

const PermissionList = [
  Read_all_forms,
  Write_active_travelers,
  Review_forms,
  Approve_travelers,
  Manage_users,
];

/**
 * get the union of the permissions granted by the given roles, per the
 * configured role->permission mapping. A role with no entry in the mapping
 * grants nothing; a permission listed in the mapping that is not one of the
 * five above is dropped rather than propagated.
 * @param {Array<String>} roles
 * @returns {Array<String>} de-duplicated list of permissions
 */
function getPermissions(roles) {
  const permissionConfig = config.permission || {};
  const permissionSet = new Set();
  roles.forEach(role => {
    if (Object.prototype.hasOwnProperty.call(permissionConfig, role)) {
      permissionConfig[role].forEach(p => permissionSet.add(p));
    }
  });
  return Array.from(permissionSet).filter(p => PermissionList.includes(p));
}

module.exports = {
  Read_all_forms,
  Write_active_travelers,
  Review_forms,
  Approve_travelers,
  Manage_users,
  PermissionList,
  getPermissions,
};
