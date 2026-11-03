// Feature: admin "add user" via the AD typeahead on views/admin.jade
// (routes/user.js). Exercises two fixes: (1) the frontend now refers to the
// selected typeahead suggestion by its full object (uid + displayName), not
// by re-looking-up whatever text is in the box; (2) the backend now looks
// the directory up, and checks for an existing account, by uid rather than
// display name.
// Persona: primary is the acting admin. The test subject is the unused LDAP
// seed account `guobao` (see README.md); there is no app-level route to
// delete a User, so teardown removes it directly via mongo-express.
const { test, expect } = require('@playwright/test');
const { call } = require('./fixtures/api-client');
const { useScenarioHooks } = require('./fixtures/scenario');
const { deleteUserDocument } = require('./fixtures/mongo-express');

useScenarioHooks(test);

const TEST_UID = 'guobao';

test.afterEach(async () => {
  await deleteUserDocument(TEST_UID);
});

async function lookUpInDirectory() {
  const res = await call('primary', 'GET', `/adusernames?term=${TEST_UID}`);
  const match = res.body.find(
    u => (u.uid || u.sAMAccountName || '').toLowerCase() === TEST_UID
  );
  if (!match) {
    throw new Error(`${TEST_UID} was not found in the test directory`);
  }
  return match;
}

async function selectFromTypeahead(page, displayName) {
  await page.fill('#username', displayName);
  await page.waitForSelector('.tt-suggestion', { state: 'visible' });
  await page
    .locator('.tt-suggestion', { hasText: displayName })
    .first()
    // typeahead.js layers a ".tt-hint" ghost-text input on top of the
    // dropdown, which intercepts a normal click at the same coordinates.
    .click({ force: true });
}

test('an admin adds a never-before-seen AD user by selecting them from the typeahead', async ({
  page,
}) => {
  const adUser = await lookUpInDirectory();

  await page.goto('/admin/');
  await selectFromTypeahead(page, adUser.displayName);
  await page.check('#reviwer');
  await page.click('#add');

  await expect(page.locator('#message')).toContainText('new user is at');

  const stored = (await call('primary', 'GET', `/users/${TEST_UID}/json`)).body;
  expect(stored._id).toBe(TEST_UID);
  expect(stored.name).toBe(adUser.displayName);
  expect(stored.roles).toContain('reviewer');
});

test('adding the same user again is recognized by uid, not re-created', async ({
  page,
}) => {
  const adUser = await lookUpInDirectory();

  await page.goto('/admin/');
  await selectFromTypeahead(page, adUser.displayName);
  await page.click('#add');
  await expect(page.locator('#message')).toContainText('new user is at');

  await page.goto('/admin/');
  await selectFromTypeahead(page, adUser.displayName);
  await page.click('#add');
  await expect(page.locator('#message').last()).toContainText('user is at');
  await expect(page.locator('#message').last()).not.toContainText('new user');
});
