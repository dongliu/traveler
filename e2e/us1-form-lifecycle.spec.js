// User Story 1: form authoring and release lifecycle.
// Persona: primary is the form owner (admin); secondary is the designated reviewer.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { call, send } = require('./fixtures/api-client');
const { record } = require('./fixtures/artifact-registry');
const { useScenarioHooks } = require('./fixtures/scenario');
const {
  getForm,
  createForm,
  submitForReview,
  addReviewRequest,
  submitReviewResult,
  releaseForm,
  getReleasedForm,
  createReleasedForm,
} = require('./fixtures/forms');
const { grantRole } = require('./fixtures/roles');

useScenarioHooks(test);

test.describe('User Story 1 - form authoring and release', () => {
  test('AS1 owner creates a draft form with a title and an input field', async ({
    page,
  }) => {
    const title = `e2e draft ${runId()}`;
    await page.goto('/forms/new');
    await page.fill('input[name="title"]', title);
    await page.click('button:has-text("Confirm")');
    await page.waitForURL(/\/forms\/[0-9a-f]{24}\/?$/);
    const id = page.url().match(/\/forms\/([0-9a-f]{24})/)[1];
    record({ kind: 'form', id, title, ownerPersona: 'primary' });

    await call('primary', 'PUT', `/forms/${id}/`, {
      html:
        '<div class="control-group"><input type="text" name="e2e-field"></div>',
    });
    const form = await getForm('primary', id);
    expect(form.status).toBe(0);
    expect(form.title).toBe(title);
    expect(form.html).toContain('e2e-field');
  });

  test('AS2 owner submits for review and designates a reviewer', async () => {
    const form = await createForm('primary', {
      title: `e2e review ${runId()}`,
    });
    await grantRole('primary', 'secondary', 'reviewer');
    await submitForReview('primary', form.id);
    await addReviewRequest('primary', form.id, 'secondary');

    expect((await getForm('primary', form.id)).status).toBe(0.5);
    const reviews = await call('secondary', 'GET', '/reviews/forms/json');
    expect(JSON.stringify(reviews.body)).toContain(form.id);
  });

  test('AS3 reviewer approves, then owner releases into a snapshot', async () => {
    const html = '<p>e2e released snapshot</p>';
    const form = await createForm('primary', {
      title: `e2e release ${runId()}`,
      html,
    });
    await grantRole('primary', 'secondary', 'reviewer');
    await submitForReview('primary', form.id);
    await addReviewRequest('primary', form.id, 'secondary');
    await submitReviewResult('secondary', form.id, 'approve');

    const releasedId = await releaseForm('primary', form.id);
    const released = await getReleasedForm('primary', releasedId);
    expect(released.status).toBe(1);
    expect(released.base.html).toContain('e2e released snapshot');
    expect((await getForm('primary', form.id)).status).toBe(1);
  });

  test('AS4 reviewer requests changes, form reverts to draft and cannot be released', async () => {
    const form = await createForm('primary', {
      title: `e2e changes ${runId()}`,
    });
    await grantRole('primary', 'secondary', 'reviewer');
    await submitForReview('primary', form.id);
    await addReviewRequest('primary', form.id, 'secondary');
    await submitReviewResult('secondary', form.id, 'requestChanges');

    const reverted = await getForm('primary', form.id);
    expect(reverted.status).toBe(0);
    expect(reverted.__review.reviewRequests).toHaveLength(0);

    const blocked = await send(
      'primary',
      'PUT',
      `/forms/${form.id}/released`,
      {}
    );
    expect(blocked.status).toBe(400);

    await submitForReview('primary', form.id);
    await addReviewRequest('primary', form.id, 'secondary');
    await submitReviewResult('secondary', form.id, 'approve');
    await releaseForm('primary', form.id);
    expect((await getForm('primary', form.id)).status).toBe(1);
  });

  test('AS5 a released form cannot be edited and its snapshot stays unchanged', async () => {
    const released = await createReleasedForm('primary', 'secondary', {
      title: `e2e immutable ${runId()}`,
      html: '<p>e2e original</p>',
    });

    const edit = await send('primary', 'PUT', `/forms/${released.formId}/`, {
      html: '<p>e2e changed</p>',
    });
    expect(edit.status).toBe(400);

    const snapshot = await getReleasedForm('primary', released.releasedId);
    expect(snapshot.base.html).toContain('e2e original');
    expect(snapshot.base.html).not.toContain('e2e changed');
  });

  test('AS6 creating a form without a title is rejected and nothing is saved', async () => {
    const before = (await call('primary', 'GET', '/forms/json')).body.length;
    const res = await send('primary', 'POST', '/forms/', {
      html: '<p>untitled</p>',
    });
    expect(res.status).toBe(400);
    const after = (await call('primary', 'GET', '/forms/json')).body.length;
    expect(after).toBe(before);
  });

  test('AS7 owner archives a released form and it leaves the active list', async () => {
    const released = await createReleasedForm('primary', 'secondary', {
      title: `e2e archive ${runId()}`,
      html: '<p>e2e archive</p>',
    });
    const current = await getReleasedForm('primary', released.releasedId);
    await call(
      'primary',
      'PUT',
      `/released-forms/${released.releasedId}/status`,
      {
        status: 2,
        version: current.ver,
      }
    );

    const active = (await call('primary', 'GET', '/released-forms/json')).body;
    expect(JSON.stringify(active)).not.toContain(released.releasedId);
    const archived = (
      await call('primary', 'GET', '/archived-released-forms/json')
    ).body;
    expect(JSON.stringify(archived)).toContain(released.releasedId);
  });
});
