/**
 * The roles defined in the file are only the additional roles other than
 * default roles. Default roles are defined in config file and assigned to users
 * when they log in. Default roles cannot be removed from a user. Additional
 * roles can be assigned to or removed from users by admin users.
 */

const Manager = 'manager';
const Admin = 'admin';
const Reviewer = 'reviewer';
const Roles = [Manager, Admin, Reviewer];

module.exports = {
  Manager,
  Admin,
  Reviewer,
  Roles,
};
