const { call } = require('./api-client');
const { personas } = require('./env');
const { registerUndo } = require('./artifact-registry');
const { refreshSession } = require('./session');

async function createGroup(admin, name) {
  await call(admin, 'POST', '/groups/', { name });
  return name.toLowerCase();
}

async function getGroup(admin, groupId) {
  return (
    await call(admin, 'GET', `/groups/${encodeURIComponent(groupId)}/json`)
  ).body;
}

async function setGroupMembers(admin, groupId, members, personaNames) {
  await call(admin, 'PUT', `/groups/${encodeURIComponent(groupId)}`, {
    members,
  });
  for (const name of personaNames) {
    await refreshSession(name);
  }
}

// Membership is written straight onto the group document: PUT /groups/:id is
// admin-only and needs no LDAP lookup. The addmember route reads sAMAccountName,
// which the local docker LDAP does not return, so it cannot be used here.
async function addGroupMember(admin, groupId, personaName) {
  const uid = personas[personaName].id;
  const group = await getGroup(admin, groupId);
  const before = [...(group.members || [])];
  if (before.includes(uid)) {
    return;
  }
  registerUndo(() => setGroupMembers(admin, groupId, before, [personaName]));
  await setGroupMembers(admin, groupId, [...before, uid], [personaName]);
}

async function removeGroupMembers(admin, groupId, personaNames) {
  const uids = personaNames.map(name => personas[name].id);
  const group = await getGroup(admin, groupId);
  const before = [...(group.members || [])];
  registerUndo(() => setGroupMembers(admin, groupId, before, personaNames));
  await call(
    admin,
    'PUT',
    `/groups/${encodeURIComponent(groupId)}/removeMembers`,
    uids.map(_id => ({ _id }))
  );
  for (const name of personaNames) {
    await refreshSession(name);
  }
}

module.exports = { createGroup, getGroup, addGroupMember, removeGroupMembers };
