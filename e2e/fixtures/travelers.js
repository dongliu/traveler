const { call, idFromResponse } = require('./api-client');
const { record } = require('./artifact-registry');

async function getTraveler(name, travelerId) {
  return (await call(name, 'GET', `/travelers/${travelerId}/json`)).body;
}

async function createTravelerFromReleasedForm(owner, releasedId) {
  const res = await call(owner, 'POST', '/travelers/', { form: releasedId });
  const id = idFromResponse(res);
  const traveler = await getTraveler(owner, id);
  record({
    kind: 'traveler',
    id,
    title: traveler.title,
    ownerPersona: owner,
    dependsOn: [releasedId],
  });
  return { id, title: traveler.title };
}

async function setTravelerStatus(name, travelerId, status) {
  await call(name, 'PUT', `/travelers/${travelerId}/status`, { status });
}

const PATHS = { 1: [1], 1.5: [1, 1.5], 2: [1, 1.5, 2], 3: [1, 3], 4: [4] };

// Walks the traveler through each valid transition to reach the target status.
async function positionTraveler(admin, travelerId, target) {
  for (const status of PATHS[target]) {
    await setTravelerStatus(admin, travelerId, status);
  }
}

async function enterTravelerData(
  name,
  travelerId,
  { field, value, type = 'text' }
) {
  await call(name, 'POST', `/travelers/${travelerId}/data/`, {
    name: field,
    value,
    type,
  });
}

module.exports = {
  getTraveler,
  createTravelerFromReleasedForm,
  setTravelerStatus,
  positionTraveler,
  enterTravelerData,
};
