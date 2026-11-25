/**
 * All permissions are defined here.
 * Authorization process:
 * 1. get login user roles
 * 2. get the union of the permission from all roles
 * 3. authorize the action from the union
 */

const config = require('../config/config.js');
const permissionConfig = config.permission;
const Read_all_forms = 'read_all_forms';
const Write_all_forms = 'write_all_forms';
const Write_active_travelers = 'write_active_travelers';
const Review_forms = 'review_forms';
const Approve_travelers = 'approve_travelers';
const Manage_users = 'manage_users';
const PermissionList = [
  Read_all_forms,
  Write_all_forms,
  Write_active_travelers,
  Review_forms,
  Approve_travelers,
  Manage_users,
];
// Default role every user has (see config auth.json's default_roles). Its
// permissions below always apply, even if the deployed permission.json
// configuration file omits or changes the 'user' entry.
const Default_role = 'user';
const Default_role_permissions = [
  Read_all_forms,
  Write_all_forms,
  Write_active_travelers,
  Review_forms,
  Approve_travelers,
];
/**
 * get all the permissions for the given role list and permission config
 * @param  {Array<String>} roles
 * @returns {Array<String>} an array of permissions
 */
function getPermissions(roles) {
  const permissionSet = new Set();
  roles.forEach(role => {
    if (role === Default_role) {
      Default_role_permissions.forEach(p => permissionSet.add(p));
    }
    if (Object.hasOwn(permissionConfig, role)) {
      permissionConfig[role].forEach(p => permissionSet.add(p));
    }
  });
  return Array.from(permissionSet).filter(p => PermissionList.includes(p));
}

module.exports = {
  Read_all_forms,
  Write_all_forms,
  Write_active_travelers,
  Review_forms,
  Approve_travelers,
  Manage_users,
  Default_role,
  Default_role_permissions,
  getPermissions,
};
