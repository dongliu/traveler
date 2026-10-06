// User Story 5: binder management.
// Persona: primary builds and owns the binder; secondary is the reader used to
// check the binder's own access rules.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { send, call } = require('./fixtures/api-client');
const { personas } = require('./fixtures/env');
const { useScenarioHooks } = require('./fixtures/scenario');
const { createReleasedForm } = require('./fixtures/forms');
const {
  createTravelerFromReleasedForm,
  getTraveler,
} = require('./fixtures/travelers');
const {
  createBinder,
  addTravelersToBinder,
  listBinderWorks,
  removeBinderWork,
} = require('./fixtures/binders');
const {
  shareWithUser,
  revokeShare,
  setPublicAccess,
} = require('./fixtures/sharing');

useScenarioHooks(test);

async function twoTravelers(tag) {
  const released = await createReleasedForm('primary', 'secondary', {
    title: `e2e binder ${tag}`,
    html: '<p>e2e binder</p>',
  });
  const first = await createTravelerFromReleasedForm(
    'primary',
    released.releasedId
  );
  const second = await createTravelerFromReleasedForm(
    'primary',
    released.releasedId
  );
  return [first, second];
}

test.describe('User Story 5 - binder management', () => {
  test('AS1 a new binder lists exactly the travelers added to it', async () => {
    const tag = runId();
    const [first, second] = await twoTravelers(tag);
    const binder = await createBinder('primary', `e2e binder ${tag}`);
    await addTravelersToBinder('primary', binder.id, [first.id, second.id]);

    const works = await listBinderWorks('primary', binder.id);
    expect(works).toHaveLength(2);
    const text = JSON.stringify(works);
    expect(text).toContain(first.id);
    expect(text).toContain(second.id);
  });

  test('AS2 removing a traveler from a binder leaves the traveler itself in place', async () => {
    const tag = runId();
    const [first, second] = await twoTravelers(tag);
    const binder = await createBinder('primary', `e2e remove ${tag}`);
    await addTravelersToBinder('primary', binder.id, [first.id, second.id]);

    await removeBinderWork('primary', binder.id, first.id);
    expect(
      JSON.stringify(await listBinderWorks('primary', binder.id))
    ).not.toContain(first.id);
    expect((await getTraveler('primary', first.id)).id).toBe(first.id);
  });

  test('AS3 binder access follows the same private, shared, and public rules as forms', async () => {
    const binder = await createBinder(
      'primary',
      `e2e binder access ${runId()}`
    );
    const read = () => send('secondary', 'GET', `/binders/${binder.id}/json`);

    await setPublicAccess('primary', 'binders', binder.id, -1);
    expect((await read()).status).toBe(403);

    await shareWithUser('primary', 'binders', binder.id, {
      displayName: personas.secondary.displayName,
      access: 'read',
    });
    expect((await read()).status).toBe(200);

    await revokeShare(
      'primary',
      'binders',
      binder.id,
      'users',
      personas.secondary.id
    );
    expect((await read()).status).toBe(403);

    await setPublicAccess('primary', 'binders', binder.id, 0);
    expect((await read()).status).toBe(200);
    await setPublicAccess('primary', 'binders', binder.id, -1);
    expect((await read()).status).toBe(403);
  });
});
