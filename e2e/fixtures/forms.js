const { call, idFromResponse } = require('./api-client');
const { personas } = require('./env');
const { record } = require('./artifact-registry');
const { grantRole } = require('./roles');

async function getForm(name, formId) {
  return (await call(name, 'GET', `/forms/${formId}/json`)).body;
}

async function createForm(owner, { title, html = '<p>e2e</p>' }) {
  const res = await call(owner, 'POST', '/forms/', { title, html });
  const id = idFromResponse(res);
  record({ kind: 'form', id, title, ownerPersona: owner });
  return { id, title };
}

async function submitForReview(owner, formId) {
  const form = await getForm(owner, formId);
  await call(owner, 'PUT', `/forms/${formId}/status`, {
    status: 0.5,
    version: form._v,
  });
}

async function addReviewRequest(owner, formId, reviewerName) {
  const reviewer = personas[reviewerName];
  await call(owner, 'POST', `/forms/${formId}/review/requests`, {
    uid: reviewer.id,
    name: reviewer.displayName,
  });
}

async function removeReviewRequest(owner, formId, reviewerName) {
  await call(
    owner,
    'DELETE',
    `/forms/${formId}/review/requests/${personas[reviewerName].id}`
  );
}

async function submitReviewResult(reviewerName, formId, decision) {
  const form = await getForm(reviewerName, formId);
  const result = decision === 'approve' ? '1' : '2';
  await call(reviewerName, 'POST', `/forms/${formId}/review/results`, {
    result,
    v: form._v,
  });
}

async function releaseForm(owner, formId) {
  const res = await call(owner, 'PUT', `/forms/${formId}/released`, {});
  const releasedId = idFromResponse(res);
  const form = await getForm(owner, formId);
  record({
    kind: 'releasedForm',
    id: releasedId,
    title: form.title,
    ownerPersona: owner,
    dependsOn: [formId],
  });
  return releasedId;
}

async function getReleasedForm(name, releasedId) {
  return (await call(name, 'GET', `/released-forms/${releasedId}/json`)).body;
}

async function createReleasedForm(owner, reviewerName, { title, html }) {
  const form = await createForm(owner, { title, html });
  await submitForReview(owner, form.id);
  await grantRole('primary', reviewerName, 'reviewer');
  await addReviewRequest(owner, form.id, reviewerName);
  await submitReviewResult(reviewerName, form.id, 'approve');
  const releasedId = await releaseForm(owner, form.id);
  const released = await getReleasedForm(owner, releasedId);
  return {
    formId: form.id,
    releasedId,
    ver: released.ver,
    title,
    html: released.base.html,
  };
}

module.exports = {
  getForm,
  createForm,
  submitForReview,
  addReviewRequest,
  removeReviewRequest,
  submitReviewResult,
  releaseForm,
  getReleasedForm,
  createReleasedForm,
};
