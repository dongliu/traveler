const { call, idFromResponse } = require('./api-client');
const { record } = require('./artifact-registry');

async function getBinder(name, binderId) {
  return (await call(name, 'GET', `/binders/${binderId}/json`)).body;
}

async function createBinder(owner, title) {
  const res = await call(owner, 'POST', '/binders/', { title });
  const id = idFromResponse(res);
  record({ kind: 'binder', id, title, ownerPersona: owner });
  return { id, title };
}

async function addTravelersToBinder(owner, binderId, travelerIds) {
  await call(owner, 'POST', `/binders/${binderId}/`, {
    ids: travelerIds,
    type: 'traveler',
  });
}

async function listBinderWorks(name, binderId) {
  const body = (await call(name, 'GET', `/binders/${binderId}/works/json`))
    .body;
  return body.works || [];
}

async function removeBinderWork(owner, binderId, workId) {
  await call(owner, 'DELETE', `/binders/${binderId}/works/${workId}`);
}

module.exports = {
  getBinder,
  createBinder,
  addTravelersToBinder,
  listBinderWorks,
  removeBinderWork,
};
