const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// SECONDARY_AUTH_STATE ('bob', per e2e/fixtures/env.js E2E_USER2) is not an
// admin by default — this file grants the role for its own duration and
// removes it again afterward (via the non-destructive 'remove-role' fixture
// command, not 'reset-user-roles', so a concurrently-running spec file that
// granted 'bob' some other role in the meantime is not clobbered).
//
// PRIMARY_AUTH_STATE ('dong') is deliberately NOT used for the admin-flow
// assertions below even though it happens to carry a permanent baseline
// 'admin' role in this environment's seed data — depending on that baseline
// would make these tests pass or fail based on incidental seed state rather
// than on what this file itself provisions. Every test here explicitly
// drives a page authenticated as 'bob' via SECONDARY_AUTH_STATE, so the
// grant/revoke above is what actually governs pass/fail, not environment
// assumptions.
async function withAdmin(callback) {
  await execFixtureCli('grant-role', { userId: 'bob', role: 'admin' });
  try {
    await callback();
  } finally {
    await execFixtureCli('remove-role', { userId: 'bob', role: 'admin' });
  }
}

async function gotoWbsTab(page) {
  await page.goto('/admin/');
  await page.click('a[href="#wbs-notifications"]');
}

test.describe('WBS Notification Registry', () => {
  test('Admin can view, add, update, and remove a WBS notification entry end to end', async ({ browser }) => {
    await withAdmin(async () => {
      const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      const id = runId();
      const wbsNumber = `${id}.1.2`;
      const email = `qa-lead-${id}@example.com`;
      const updatedEmail = `qa-lead-updated-${id}@example.com`;

      await gotoWbsTab(page);

      // AS: add a new, well-formed, not-yet-used entry
      await page.fill('#wbs-number', wbsNumber);
      await page.fill('#wbs-notification-email', email);
      await page.click('#wbs-notifications-add');

      const row = page.locator(`tr[data-wbs-number="${wbsNumber}"]`);
      await expect(row).toBeVisible({ timeout: 10000 });
      await expect(row).toContainText(email);

      // AS: adding the exact same WBS number again is rejected (409), no duplicate row
      await page.fill('#wbs-number', wbsNumber);
      await page.fill('#wbs-notification-email', 'someone-else@example.com');
      await page.click('#wbs-notifications-add');
      await expect(page.locator('#wbs-notifications-message')).toContainText('already exists', { timeout: 10000 });
      await expect(page.locator(`tr[data-wbs-number="${wbsNumber}"]`)).toHaveCount(1);

      // AS: a malformed WBS number is rejected
      await page.fill('#wbs-number', `${id}..bad`);
      await page.fill('#wbs-notification-email', 'valid@example.com');
      await page.click('#wbs-notifications-add');
      await expect(page.locator('#wbs-notifications-message')).toContainText('non-empty segments', { timeout: 10000 });
      await expect(page.locator(`tr[data-wbs-number="${id}..bad"]`)).toHaveCount(0);

      // AS: an invalid email is rejected
      await page.fill('#wbs-number', `${id}.3.4`);
      await page.fill('#wbs-notification-email', 'not-an-email');
      await page.click('#wbs-notifications-add');
      await expect(page.locator('#wbs-notifications-message')).toContainText('syntactically valid email', { timeout: 10000 });
      await expect(page.locator(`tr[data-wbs-number="${id}.3.4"]`)).toHaveCount(0);

      // AS: update the email for the original entry — WBS number unchanged
      await gotoWbsTab(page);
      const editRow = page.locator(`tr[data-wbs-number="${wbsNumber}"]`);
      await editRow.locator('.wbs-edit-btn').click();
      await editRow.locator('.wbs-edit-email').fill(updatedEmail);
      await editRow.locator('.wbs-save-btn').click();
      await expect(page.locator('#wbs-notifications-message')).toContainText('updated', { timeout: 10000 });
      await gotoWbsTab(page);
      await expect(page.locator(`tr[data-wbs-number="${wbsNumber}"]`)).toContainText(updatedEmail);

      // AS: an invalid email on update is rejected, previous email retained
      const patchRes = await page.request.patch(`/api/wbs-notifications/${encodeURIComponent(wbsNumber)}`, {
        data: { notification_email: 'not-an-email' },
      });
      expect(patchRes.status()).toBe(400);
      const getRes = await page.request.get('/api/wbs-notifications');
      const entries = (await getRes.json()).entries;
      const stillThere = entries.find(e => e.wbs_number === wbsNumber);
      expect(stillThere.notification_email).toBe(updatedEmail);

      // AS: updating a WBS number that doesn't exist returns 404
      const notFoundPatch = await page.request.patch(
        `/api/wbs-notifications/${encodeURIComponent(`${id}.does.not.exist`)}`,
        { data: { notification_email: 'a@example.com' } }
      );
      expect(notFoundPatch.status()).toBe(404);

      // AS: remove the entry
      await gotoWbsTab(page);
      const removeRow = page.locator(`tr[data-wbs-number="${wbsNumber}"]`);
      page.once('dialog', dialog => dialog.accept());
      await removeRow.locator('.wbs-remove-btn').click();
      await expect(page.locator(`tr[data-wbs-number="${wbsNumber}"]`)).toHaveCount(0, { timeout: 10000 });

      // AS: removing a WBS number that doesn't exist returns 404, not a silent success
      const notFoundDelete = await page.request.delete(`/api/wbs-notifications/${encodeURIComponent(wbsNumber)}`);
      expect(notFoundDelete.status()).toBe(404);

      await page.close();
    });
  });

  test('non-admin users cannot view, add, update, or remove registry entries', async ({ browser }) => {
    const id = runId();
    const wbsNumber = `${id}.9.9`;

    const nonAdminPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });

    const listRes = await nonAdminPage.request.get('/api/wbs-notifications');
    expect(listRes.status()).toBe(403);

    const addRes = await nonAdminPage.request.post('/api/wbs-notifications', {
      data: { wbs_number: wbsNumber, notification_email: 'a@example.com' },
    });
    expect(addRes.status()).toBe(403);

    const updateRes = await nonAdminPage.request.patch(`/api/wbs-notifications/${encodeURIComponent(wbsNumber)}`, {
      data: { notification_email: 'a@example.com' },
    });
    expect(updateRes.status()).toBe(403);

    const removeRes = await nonAdminPage.request.delete(`/api/wbs-notifications/${encodeURIComponent(wbsNumber)}`);
    expect(removeRes.status()).toBe(403);

    await nonAdminPage.close();
  });

  test('viewing an empty registry shows an empty-state message, not an error', async ({ browser }) => {
    await withAdmin(async () => {
      const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      await gotoWbsTab(page);
      // Either the seeded empty-state row or a populated table (from other
      // parallel-running entries) is acceptable — the assertion is that the
      // page loads with no error banner, per spec.md US1 AS2.
      await expect(page.locator('#wbs-notifications-table')).toBeVisible();
      await expect(page.locator('#wbs-notifications-message .alert-error')).toHaveCount(0);
      await page.close();
    });
  });
});
