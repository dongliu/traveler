// User Story 2: traveler data entry and completion lifecycle.
// Persona: primary is the traveler owner and admin; secondary holds write access
// on one traveler and no admin or manager role.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { call, send } = require('./fixtures/api-client');
const { personas } = require('./fixtures/env');
const { useScenarioHooks } = require('./fixtures/scenario');
const { createReleasedForm } = require('./fixtures/forms');
const { shareWithUser } = require('./fixtures/sharing');
const {
  getTraveler,
  createTravelerFromReleasedForm,
  setTravelerStatus,
  enterTravelerData,
} = require('./fixtures/travelers');

useScenarioHooks(test);

async function newReleasedForm(tag) {
  return createReleasedForm('primary', 'secondary', {
    title: `e2e traveler ${tag}`,
    html: '<p>e2e traveler form</p>',
  });
}

test.describe('User Story 2 - traveler data entry and completion', () => {
  test('AS1 a traveler is created from a released form with its fields copied', async () => {
    const tag = runId();
    const released = await newReleasedForm(tag);
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );

    const saved = await getTraveler('primary', traveler.id);
    expect(saved.status).toBe(0);
    expect(saved.title).toBe(released.title);
  });

  test('AS2 an active traveler records the entered value, the user, and the time', async () => {
    const tag = runId();
    const released = await newReleasedForm(tag);
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await setTravelerStatus('primary', traveler.id, 1);

    await enterTravelerData('primary', traveler.id, {
      field: 'e2e-weight',
      value: `w-${tag}`,
    });
    const saved = await getTraveler('primary', traveler.id);
    expect(saved.data).toHaveLength(1);
    const entry = (await call('primary', 'GET', `/data/${saved.data[0]}`)).body;
    expect(entry.value).toBe(`w-${tag}`);
    expect(entry.inputBy).toBe(personas.primary.id);
    expect(entry.inputOn).toBeTruthy();
  });

  test('AS3 owner submits an active traveler for completion', async () => {
    const released = await newReleasedForm(runId());
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await setTravelerStatus('primary', traveler.id, 1);
    await setTravelerStatus('primary', traveler.id, 1.5);

    expect((await getTraveler('primary', traveler.id)).status).toBe(1.5);
  });

  test('AS4 admin approves a submitted traveler to completed, or rejects it back to active', async () => {
    const released = await newReleasedForm(runId());
    const approved = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    const rejected = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    for (const traveler of [approved, rejected]) {
      await setTravelerStatus('primary', traveler.id, 1);
      await setTravelerStatus('primary', traveler.id, 1.5);
    }

    await setTravelerStatus('primary', approved.id, 2);
    expect((await getTraveler('primary', approved.id)).status).toBe(2);

    await setTravelerStatus('primary', rejected.id, 1);
    expect((await getTraveler('primary', rejected.id)).status).toBe(1);
  });

  test('AS5 a user without admin or manager cannot approve or reject a submitted traveler', async () => {
    const released = await newReleasedForm(runId());
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await setTravelerStatus('primary', traveler.id, 1);
    await setTravelerStatus('primary', traveler.id, 1.5);

    await shareWithUser('primary', 'travelers', traveler.id, {
      displayName: personas.secondary.displayName,
      access: 'write',
    });
    const roles =
      (await send('primary', 'GET', `/users/${personas.secondary.id}/json`))
        .body.roles || [];
    expect(roles).not.toContain('admin');
    expect(roles).not.toContain('manager');

    const approve = await send(
      'secondary',
      'PUT',
      `/travelers/${traveler.id}/status`,
      { status: 2 }
    );
    const reject = await send(
      'secondary',
      'PUT',
      `/travelers/${traveler.id}/status`,
      { status: 1 }
    );
    expect(approve.status).toBe(403);
    expect(reject.status).toBe(403);
    expect((await getTraveler('primary', traveler.id)).status).toBe(1.5);
  });

  test('AS6 an active traveler can be frozen and unfrozen, and frozen travelers reject data entry', async () => {
    const released = await newReleasedForm(runId());
    const traveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await setTravelerStatus('primary', traveler.id, 1);
    await setTravelerStatus('primary', traveler.id, 3);
    expect((await getTraveler('primary', traveler.id)).status).toBe(3);

    const entry = await send(
      'primary',
      'POST',
      `/travelers/${traveler.id}/data/`,
      {
        name: 'e2e-frozen',
        value: 'nope',
        type: 'text',
      }
    );
    expect(entry.status).toBeGreaterThanOrEqual(400);

    await setTravelerStatus('primary', traveler.id, 1);
    expect((await getTraveler('primary', traveler.id)).status).toBe(1);

    const completed = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await setTravelerStatus('primary', completed.id, 1);
    await setTravelerStatus('primary', completed.id, 1.5);
    await setTravelerStatus('primary', completed.id, 2);
    const direct = await send(
      'primary',
      'PUT',
      `/travelers/${completed.id}/status`,
      { status: 3 }
    );
    expect(direct.status).toBe(400);
  });
});
