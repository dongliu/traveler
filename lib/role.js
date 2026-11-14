/**
 * The roles that can be assigned to or removed from a user account.
 * `user` is a separate, implicit default role (see lib/permission.js and
 * lib/auth/index.js) and is intentionally not part of this list - it can
 * never be added to or removed from an account.
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
