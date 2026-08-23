const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// Same rationale as e2e/us-wbs-notification-registry.spec.js: 'bob'
// (SECONDARY) is granted 'admin' for the duration of registry setup here,
// then reverted via 'remove-role' (not 'reset-user-roles', so a concurrently
// running spec file that granted 'bob' some other role isn't clobbered).
async function withAdmin(callback) {
  await execFixtureCli('grant-role', { userId: 'bob', role: 'admin' });
  try {
    await callback();
  } finally {
    await execFixtureCli('remove-role', { userId: 'bob', role: 'admin' });
  }
}

async function registerWbsNumber(browser, wbsNumber, email) {
  const page = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
  await page.goto('/admin/');
  await page.click('a[href="#wbs-notifications"]');
  await page.fill('#wbs-number', wbsNumber);
  await page.fill('#wbs-notification-email', email);
  await page.click('#wbs-notifications-add');
  await expect(page.locator(`tr[data-wbs-number="${wbsNumber}"]`)).toBeVisible({ timeout: 10000 });
  await page.close();
}

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Fills and submits the NCR creation form as the default (PRIMARY) persona, using the given WBS number. */
async function createNcrWithWbsNumber(page, wbsNumber) {
  const id = runId();
  await page.goto('/ncrs/new');
  await page.fill('#part_name', `WBS Lookup Test ${id}`);
  await page.fill('#part_number', `PN-${id}`);
  await page.fill('#part_revision', 'A');
  await page.fill('#quantity', '1');
  await page.fill('#supplier_name', `Supplier ${id}`);
  await page.fill('#wbs_number', wbsNumber);
  await page.fill('#ce_cs_name', 'Bob Dalesio');
  await page.waitForSelector('.tt-suggestion', { timeout: 5000 }).catch(() => {});
  await page.fill('#discovery_date', todayIsoDate());
  await page.check('input[name="discovery_context"][value="incoming_inspection"]');
  await page.fill('#description_of_nonconformance', `WBS hierarchical lookup test nonconformance ${id}.`);
  await page.click('#submit-btn');
  await expect(page.locator('#ncr-success')).toBeVisible({ timeout: 10000 });
  const href = await page.locator('#ncr-number-link').getAttribute('href');
  return href.split('/').pop();
}

test.describe('WBS Hierarchical Notification Lookup', () => {
  test('exact WBS match notifies the registered contact on submission', async ({ page, browser }) => {
    const id = runId();
    const wbsNumber = `${id}.1`;
    const email = `exact-${id}@example.com`;

    await withAdmin(async () => {
      await registerWbsNumber(browser, wbsNumber, email);
    });

    const ncrId = await createNcrWithWbsNumber(page, wbsNumber);

    await expect(page.locator('#wbs-notification-warning')).toBeHidden();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['events'] });
    const initialEvent = ncr.events.find(e => e.event_type === 'notification.initial');
    expect(initialEvent).toBeTruthy();
    const emails = initialEvent.recipients.map(r => r.recipient_email);
    expect(emails).toContain(email);
  });

  test('nearest ancestor WBS match notifies the closer registered parent, not a more distant one', async ({ page, browser }) => {
    const id = runId();
    const rootWbs = `${id}.2`;
    const childWbs = `${id}.2.5`;
    const grandchildWbs = `${id}.2.5.9`; // not registered — no exact match
    const rootEmail = `root-${id}@example.com`;
    const childEmail = `child-${id}@example.com`;

    await withAdmin(async () => {
      await registerWbsNumber(browser, rootWbs, rootEmail);
      await registerWbsNumber(browser, childWbs, childEmail);
    });

    const ncrId = await createNcrWithWbsNumber(page, grandchildWbs);

    await expect(page.locator('#wbs-notification-warning')).toBeHidden();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['events'] });
    const initialEvent = ncr.events.find(e => e.event_type === 'notification.initial');
    const emails = initialEvent.recipients.map(r => r.recipient_email);
    expect(emails).toContain(childEmail);
    expect(emails).not.toContain(rootEmail);
  });

  test('no match anywhere in the hierarchy warns the Originator without blocking NCR creation', async ({ page }) => {
    const id = runId();
    const wbsNumber = `${id}.9.9.9`; // fresh runId — guaranteed nothing under it is registered

    const ncrId = await createNcrWithWbsNumber(page, wbsNumber);

    await expect(page.locator('#ncr-success')).toBeVisible();
    await expect(page.locator('#wbs-notification-warning')).toBeVisible();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'events'] });
    expect(ncr.status).toBe('Submitted');
    const initialEvent = ncr.events.find(e => e.event_type === 'notification.initial');
    expect(initialEvent).toBeTruthy();
    expect(initialEvent.recipients.length).toBeGreaterThan(0);
  });
});
