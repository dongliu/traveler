// User Story 4: layered access control.
// Persona: primary owns the documents; secondary is the restricted user.
// The secondary is the only non-admin identity, so "a different non-shared user"
// is shown with the secondary before a share is granted or after it is revoked.
// Proving exclusion of an unrelated third person needs a third LDAP account.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { send } = require('./fixtures/api-client');
const { personas } = require('./fixtures/env');
const { useScenarioHooks } = require('./fixtures/scenario');
const { createForm } = require('./fixtures/forms');
const { grantRole, removeRole } = require('./fixtures/roles');
const {
  createGroup,
  addGroupMember,
  removeGroupMembers,
} = require('./fixtures/groups');
const {
  shareWithUser,
  shareWithGroup,
  setPublicAccess,
  revokeShare,
} = require('./fixtures/sharing');

useScenarioHooks(test);

// The app gives every account read_all_forms and write_active_travelers by
// default, which grants blanket access. Remove them so the secondary starts
// unprivileged. The role fixtures restore them after each test.
test.beforeEach(async () => {
  await removeRole('primary', 'secondary', 'read_all_forms');
  await removeRole('primary', 'secondary', 'write_active_travelers');
});

async function readAs(name, formId) {
  return send(name, 'GET', `/forms/${formId}/json`);
}

test.describe('User Story 4 - access control', () => {
  test('AS1 a private form owned by the primary user is refused to the secondary user', async () => {
    const form = await createForm('primary', {
      title: `e2e private ${runId()}`,
    });
    await setPublicAccess('primary', 'forms', form.id, -1);
    expect((await readAs('secondary', form.id)).status).toBe(403);
  });

  test('AS2 a user share grants access, and revoking it takes access away', async () => {
    const form = await createForm('primary', {
      title: `e2e user share ${runId()}`,
    });
    await setPublicAccess('primary', 'forms', form.id, -1);
    expect((await readAs('secondary', form.id)).status).toBe(403);

    await shareWithUser('primary', 'forms', form.id, {
      displayName: personas.secondary.displayName,
      access: 'read',
    });
    expect((await readAs('secondary', form.id)).status).toBe(200);

    await revokeShare(
      'primary',
      'forms',
      form.id,
      'users',
      personas.secondary.id
    );
    expect((await readAs('secondary', form.id)).status).toBe(403);
  });

  test('AS3 group membership grants access through a group share, and removal takes it away', async () => {
    const tag = runId();
    const form = await createForm('primary', {
      title: `e2e group share ${tag}`,
    });
    await setPublicAccess('primary', 'forms', form.id, -1);
    const groupId = await createGroup('primary', `e2e-access-${tag}`);
    await shareWithGroup('primary', 'forms', form.id, {
      groupId,
      access: 'read',
    });
    expect((await readAs('secondary', form.id)).status).toBe(403);

    await addGroupMember('primary', groupId, 'secondary');
    expect((await readAs('secondary', form.id)).status).toBe(200);

    await removeGroupMembers('primary', groupId, ['secondary']);
    expect((await readAs('secondary', form.id)).status).toBe(403);
  });

  test('AS4 public read access opens the form to everyone, and closing it shuts access again', async () => {
    const form = await createForm('primary', {
      title: `e2e public ${runId()}`,
    });
    await setPublicAccess('primary', 'forms', form.id, 0);
    expect((await readAs('secondary', form.id)).status).toBe(200);

    await setPublicAccess('primary', 'forms', form.id, -1);
    expect((await readAs('secondary', form.id)).status).toBe(403);
  });

  test('AS5 the manager role gives access to a document the user neither owns nor was shared', async () => {
    const form = await createForm('primary', {
      title: `e2e manager ${runId()}`,
    });
    await setPublicAccess('primary', 'forms', form.id, -1);
    expect((await readAs('secondary', form.id)).status).toBe(403);

    await grantRole('primary', 'secondary', 'manager');
    expect((await readAs('secondary', form.id)).status).toBe(200);

    await removeRole('primary', 'secondary', 'manager');
    expect((await readAs('secondary', form.id)).status).toBe(403);
  });
});
