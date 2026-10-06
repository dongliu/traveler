const { call } = require('./api-client');
const { personas } = require('./env');
const { registerUndo } = require('./artifact-registry');
const { refreshSession } = require('./session');

const noop = async () => {};

async function getUserRoles(name, userId) {
  const res = await call(
    name,
    'GET',
    `/users/${encodeURIComponent(userId)}/json`
  );
  if (!res.body) {
    throw new Error(`user ${userId} has no account in the application`);
  }
  return [...(res.body.roles || [])];
}

async function setUserRoles(acting, userName, roles) {
  await call(
    acting,
    'PUT',
    `/users/${encodeURIComponent(personas[userName].id)}`,
    { roles }
  );
  await refreshSession(userName);
}

async function grantRole(acting, userName, role) {
  const userId = personas[userName].id;
  const before = await getUserRoles(acting, userId);
  if (before.includes(role)) {
    return noop;
  }
  const undo = () => setUserRoles(acting, userName, before);
  registerUndo(undo);
  await setUserRoles(acting, userName, [...before, role]);
  return undo;
}

async function removeRole(acting, userName, role) {
  const userId = personas[userName].id;
  const before = await getUserRoles(acting, userId);
  if (!before.includes(role)) {
    return noop;
  }
  await setUserRoles(
    acting,
    userName,
    before.filter(r => r !== role)
  );
  const undo = () => setUserRoles(acting, userName, before);
  registerUndo(undo);
  return undo;
}

module.exports = { getUserRoles, grantRole, removeRole };
