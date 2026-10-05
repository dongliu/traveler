const { call } = require('./api-client');

const DOC_ROUTES = {
  forms: 'forms',
  travelers: 'travelers',
  binders: 'binders',
};

function docPath(docType, docId) {
  return `/${DOC_ROUTES[docType]}/${docId}`;
}

async function shareWithUser(
  owner,
  docType,
  docId,
  { displayName, access = 'read' }
) {
  await call(owner, 'POST', `${docPath(docType, docId)}/share/users/`, {
    name: displayName,
    access,
  });
}

async function shareWithGroup(
  owner,
  docType,
  docId,
  { groupId, access = 'read' }
) {
  await call(owner, 'POST', `${docPath(docType, docId)}/share/groups/`, {
    id: groupId,
    access,
  });
}

async function listShares(name, docType, docId, list) {
  return (
    await call(name, 'GET', `${docPath(docType, docId)}/share/${list}/json`)
  ).body;
}

async function revokeShare(owner, docType, docId, list, shareId) {
  await call(
    owner,
    'DELETE',
    `${docPath(docType, docId)}/share/${list}/${shareId}`
  );
}

async function setPublicAccess(owner, docType, docId, access) {
  await call(owner, 'PUT', `${docPath(docType, docId)}/share/public`, {
    access: String(access),
  });
}

async function transferOwnership(name, docType, docId, newOwnerDisplayName) {
  await call(name, 'PUT', `${docPath(docType, docId)}/owner`, {
    name: newOwnerDisplayName,
  });
}

module.exports = {
  shareWithUser,
  shareWithGroup,
  listShares,
  revokeShare,
  setPublicAccess,
  transferOwnership,
};
