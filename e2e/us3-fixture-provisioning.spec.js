// User Story 3: fixture provisioning and cleanup.
// Persona: primary is admin and owner; secondary is the ordinary user the
// fixtures act on.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { call, send } = require('./fixtures/api-client');
const { personas } = require('./fixtures/env');
const { load, currentRunId } = require('./fixtures/artifact-registry');
const { cleanOut, cleanOutAll, finishScenario } = require('./fixtures/cleanup');
const { useScenarioHooks, scenarioName } = require('./fixtures/scenario');
const {
  getForm,
  createForm,
  createReleasedForm,
  getReleasedForm,
} = require('./fixtures/forms');
const { getUserRoles, grantRole } = require('./fixtures/roles');
const { createGroup, addGroupMember } = require('./fixtures/groups');
const {
  shareWithUser,
  shareWithGroup,
  setPublicAccess,
  listShares,
} = require('./fixtures/sharing');
const {
  createTravelerFromReleasedForm,
  positionTraveler,
  getTraveler,
} = require('./fixtures/travelers');
const { createBinder, addTravelersToBinder } = require('./fixtures/binders');

useScenarioHooks(test);

let failedFormId = null;

test.describe('User Story 3 - fixture provisioning and cleanup', () => {
  test('AS1 granting a role keeps the roles the user already has', async () => {
    const before = await getUserRoles('primary', personas.secondary.id);
    await grantRole('primary', 'secondary', 'manager');
    const after = await getUserRoles('primary', personas.secondary.id);
    expect(after).toContain('manager');
    for (const role of before) {
      expect(after).toContain(role);
    }
  });

  test('AS2 a released form fixture is released with a snapshot', async () => {
    const released = await createReleasedForm('primary', 'secondary', {
      title: `e2e fixture release ${runId()}`,
      html: '<p>e2e fixture</p>',
    });
    const snapshot = await getReleasedForm('primary', released.releasedId);
    expect(snapshot.status).toBe(1);
    expect(snapshot.base.html).toContain('e2e fixture');
  });

  test('AS3 sharing fixtures put user, group, and public grants on a document', async () => {
    const tag = runId();
    const form = await createForm('primary', { title: `e2e share ${tag}` });
    const groupId = await createGroup('primary', `e2e-group-${tag}`);
    await addGroupMember('primary', groupId, 'secondary');
    await shareWithUser('primary', 'forms', form.id, {
      displayName: personas.secondary.displayName,
      access: 'read',
    });
    await shareWithGroup('primary', 'forms', form.id, {
      groupId,
      access: 'read',
    });
    await setPublicAccess('primary', 'forms', form.id, 0);

    const users = await listShares('primary', 'forms', form.id, 'users');
    expect(JSON.stringify(users)).toContain(personas.secondary.id);
    const groups = await listShares('primary', 'forms', form.id, 'groups');
    expect(JSON.stringify(groups)).toContain(groupId);
    expect((await getForm('primary', form.id)).publicAccess).toBe(0);
  });

  test('AS4 a traveler is pre-positioned at submitted for completion without UI steps', async () => {
    const released = await createReleasedForm('primary', 'secondary', {
      title: `e2e position ${runId()}`,
      html: '<p>e2e position</p>',
    });
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await positionTraveler('primary', traveler.id, 1.5);
    expect((await getTraveler('primary', traveler.id)).status).toBe(1.5);
  });

  test("AS5 a run tag filter returns only that run's forms", async () => {
    const tagA = runId();
    const tagB = runId();
    await createForm('primary', { title: `e2e tag ${tagA}` });
    await createForm('primary', { title: `e2e tag ${tagB}` });

    const forms = (await call('primary', 'GET', '/forms/json')).body;
    const matchA = forms.filter(f => f.title.includes(tagA));
    const matchB = forms.filter(f => f.title.includes(tagB));
    expect(matchA).toHaveLength(1);
    expect(matchB).toHaveLength(1);
    expect(matchA[0].title).not.toContain(tagB);
  });

  test('AS6 a passing scenario is cleaned out once it finishes', async ({}, testInfo) => {
    const released = await createReleasedForm('primary', 'secondary', {
      title: `e2e pass ${runId()}`,
      html: '<p>e2e pass</p>',
    });
    const form = await createForm('primary', {
      title: `e2e pass form ${runId()}`,
    });
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );

    await finishScenario(scenarioName(testInfo));

    expect(
      JSON.stringify((await call('primary', 'GET', '/archivedforms/json')).body)
    ).toContain(form.id);
    expect(
      JSON.stringify(
        (await call('primary', 'GET', '/archivedtravelers/json')).body
      )
    ).toContain(traveler.id);
    expect(
      JSON.stringify((await call('primary', 'GET', '/forms/json')).body)
    ).not.toContain(form.id);
  });

  test('AS7 a failing scenario still has its form cleaned out', async () => {
    test.fail();
    const form = await createForm('primary', { title: `e2e fail ${runId()}` });
    failedFormId = form.id;
    expect(form.id, 'deliberate failure after the form was created').toBe('');
  });

  test('AS7 cleanup ran for the form created by the failing scenario', async () => {
    expect(failedFormId).not.toBeNull();
    const record = load(currentRunId()).find(r => r.id === failedFormId);
    expect(record).toBeDefined();
    expect(record.cleanupStatus).toBe('archived');
  });

  test('AS8 cleanup archives a binder before the travelers it contains', async ({}, testInfo) => {
    const released = await createReleasedForm('primary', 'secondary', {
      title: `e2e order ${runId()}`,
      html: '<p>e2e order</p>',
    });
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    const binder = await createBinder('primary', `e2e binder ${runId()}`);
    await addTravelersToBinder('primary', binder.id, [traveler.id]);

    const records = load(currentRunId()).filter(
      r => r.scenarioName === scenarioName(testInfo)
    );
    await cleanOutAll(records);

    const after = load(currentRunId());
    const binderRecord = after.find(r => r.id === binder.id);
    const travelerRecord = after.find(r => r.id === traveler.id);
    expect(binderRecord.cleanupStatus).toBe('archived');
    expect(travelerRecord.cleanupStatus).toBe('archived');
    expect(binderRecord.archivedAt <= travelerRecord.archivedAt).toBe(true);
  });

  test('AS9 a failed cleanup is recorded and a later retry archives the form', async () => {
    const form = await createForm('secondary', {
      title: `e2e retry ${runId()}`,
    });
    const record = load(currentRunId()).find(r => r.id === form.id);

    const error = await cleanOut(record, {
      storagePath: '/nonexistent/session.json',
    });
    expect(error).not.toBeNull();
    const failed = load(currentRunId()).find(r => r.id === form.id);
    expect(failed.cleanupStatus).toBe('failed');
    expect(failed.cleanupError).toBeTruthy();

    expect(await cleanOut(record)).toBeNull();
    expect(load(currentRunId()).find(r => r.id === form.id).cleanupStatus).toBe(
      'archived'
    );
  });

  test('AS10 after cleanup, the run tag shows no active forms, travelers, or binders', async ({}, testInfo) => {
    const released = await createReleasedForm('primary', 'secondary', {
      title: `e2e visible ${runId()}`,
      html: '<p>e2e visible</p>',
    });
    const form = await createForm('primary', {
      title: `e2e visible form ${runId()}`,
    });
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    const binder = await createBinder(
      'primary',
      `e2e visible binder ${runId()}`
    );

    await finishScenario(scenarioName(testInfo));

    expect(
      JSON.stringify((await call('primary', 'GET', '/forms/json')).body)
    ).not.toContain(form.id);
    expect(
      JSON.stringify((await call('primary', 'GET', '/travelers/json')).body)
    ).not.toContain(traveler.id);
    expect(
      JSON.stringify((await call('primary', 'GET', '/binders/json')).body)
    ).not.toContain(binder.id);
    expect(
      JSON.stringify((await call('primary', 'GET', '/archivedforms/json')).body)
    ).toContain(form.id);
    expect(
      JSON.stringify(
        (await call('primary', 'GET', '/archivedtravelers/json')).body
      )
    ).toContain(traveler.id);
    expect(
      JSON.stringify(
        (await call('primary', 'GET', '/archivedbinders/json')).body
      )
    ).toContain(binder.id);
  });
});
