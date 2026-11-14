// Feature 007: role and permission separation.
// Persona: primary is the acting admin; secondary is the account whose
// roles/permissions are exercised. Form/traveler setup uses primary as both
// owner and reviewer (self-review) so it never touches secondary's roles,
// keeping each test's role setup isolated to what it's actually testing.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { send, call } = require('./fixtures/api-client');
const { personas } = require('./fixtures/env');
const { useScenarioHooks } = require('./fixtures/scenario');
const { createForm, createReleasedForm } = require('./fixtures/forms');
const { getUserRoles, grantRole, removeRole } = require('./fixtures/roles');
const { setPublicAccess } = require('./fixtures/sharing');
const {
  createTravelerFromReleasedForm,
  positionTraveler,
} = require('./fixtures/travelers');

useScenarioHooks(test);

async function setTravelerStatus(name, travelerId, status) {
  return send(name, 'PUT', `/travelers/${travelerId}/status`, { status });
}

test.describe('US1 - admin grants and revokes roles for a user', () => {
  test('granting then revoking manager changes the ability to approve a submitted traveler', async () => {
    const released = await createReleasedForm('primary', 'primary', {
      title: `e2e role-sep ${runId()}`,
      html: '<p>e2e</p>',
    });

    const firstTraveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await positionTraveler('primary', firstTraveler.id, 1.5);
    expect(
      (await setTravelerStatus('secondary', firstTraveler.id, 2)).status
    ).toBe(403);

    await grantRole('primary', 'secondary', 'manager');
    expect(
      (await setTravelerStatus('secondary', firstTraveler.id, 2)).status
    ).toBe(200);

    await removeRole('primary', 'secondary', 'manager');
    const secondTraveler = await createTravelerFromReleasedForm(
      'primary',
      released.releasedId
    );
    await positionTraveler('primary', secondTraveler.id, 1.5);
    expect(
      (await setTravelerStatus('secondary', secondTraveler.id, 2)).status
    ).toBe(403);
  });
});

test.describe(
  'US2 - every account keeps its baseline abilities no matter what',
  () => {
    test('a secondary with no optional roles can still read a private form (baseline Read_all_forms)', async () => {
      const before = await getUserRoles('primary', personas.secondary.id);
      for (const role of before) {
        await removeRole('primary', 'secondary', role);
      }

      const form = await createForm('primary', {
        title: `e2e baseline ${runId()}`,
      });
      await setPublicAccess('primary', 'forms', form.id, -1);

      expect(
        (await send('secondary', 'GET', `/forms/${form.id}/json`)).status
      ).toBe(200);
    });

    test("submitting 'user' as a role to add has no effect on the stored roles", async () => {
      await grantRole('primary', 'secondary', 'manager');
      const before = await getUserRoles('primary', personas.secondary.id);

      await call('primary', 'PUT', `/users/${personas.secondary.id}`, {
        roles: ['user', ...before],
      });

      const after = await getUserRoles('primary', personas.secondary.id);
      expect(after).not.toContain('user');
      expect([...after].sort()).toEqual([...before].sort());
    });
  }
);

test.describe(
  'US3 - role-to-permission mapping drives form review access',
  () => {
    async function listReviewQueue(name) {
      return send(name, 'GET', '/reviews/forms/json');
    }

    test('granting reviewer opens the form-review queue; removing it closes it again', async () => {
      expect((await listReviewQueue('secondary')).status).toBe(403);

      await grantRole('primary', 'secondary', 'reviewer');
      expect((await listReviewQueue('secondary')).status).toBe(200);

      await removeRole('primary', 'secondary', 'reviewer');
      expect((await listReviewQueue('secondary')).status).toBe(403);
    });
  }
);
