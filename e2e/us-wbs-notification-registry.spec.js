const { test, expect } = require('@playwright/test');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// 'bob' (SECONDARY_AUTH_STATE) is not an admin by default.
// The withAdmin wrapper grants and revokes the role for the duration of its callback.
async function withAdmin(callback) {
  await execFixtureCli('grant-role', { userId: 'bob', role: 'admin' });
  try {
    await callback();
  } finally {
    await execFixtureCli('remove-role', { userId: 'bob', role: 'admin' });
  }
}

test.describe('WBS Notification Registry', () => {
  test('Admin can view the WBS notification tab with a read-only mapping table', async ({ browser }) => {
    await withAdmin(async () => {
      const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      await page.goto('/admin/');
      await page.click('a[href="#wbs-notifications"]');

      // Table and read-only note are visible
      await expect(page.locator('#wbs-notifications-table')).toBeVisible();
      await expect(page.locator('#wbs-notifications-message .alert-error')).toHaveCount(0);
      // The informational note about wbs.yaml should be present
      await expect(page.locator('#wbs-notifications')).toContainText('wbs.yaml');

      // No add form present (CRUD removed)
      await expect(page.locator('#wbs-notifications-add-form')).toHaveCount(0);

      await page.close();
    });
  });

  test('GET /api/wbs-notifications returns configured entries with source: config', async ({ browser }) => {
    await withAdmin(async () => {
      const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      const res = await page.request.get('/api/wbs-notifications');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.entries)).toBe(true);
      // Every returned entry must carry source: 'config'
      for (const entry of body.entries) {
        expect(entry.source).toBe('config');
        expect(typeof entry.wbs_number).toBe('string');
        expect(typeof entry.notification_email).toBe('string');
      }
      await page.close();
    });
  });

  test('POST /api/wbs-notifications returns 404 (route removed)', async ({ browser }) => {
    await withAdmin(async () => {
      const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      const res = await page.request.post('/api/wbs-notifications', {
        data: { wbs_number: '9.9.9', notification_email: 'a@example.com' },
      });
      expect(res.status()).toBe(404);
      await page.close();
    });
  });

  test('PATCH /api/wbs-notifications/:id returns 404 (route removed)', async ({ browser }) => {
    await withAdmin(async () => {
      const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      const res = await page.request.patch('/api/wbs-notifications/9.9.9', {
        data: { notification_email: 'a@example.com' },
      });
      expect(res.status()).toBe(404);
      await page.close();
    });
  });

  test('DELETE /api/wbs-notifications/:id returns 404 (route removed)', async ({ browser }) => {
    await withAdmin(async () => {
      const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      const res = await page.request.delete('/api/wbs-notifications/9.9.9');
      expect(res.status()).toBe(404);
      await page.close();
    });
  });

  test('Non-admin users cannot GET the WBS notification list', async ({ browser }) => {
    const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    const listRes = await page.request.get('/api/wbs-notifications');
    expect(listRes.status()).toBe(403);
    await page.close();
  });
});
