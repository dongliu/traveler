const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');

// WBS entries pre-loaded via docker/wbs.yaml (loaded at app startup).
// Numeric WBS numbers are used here to confirm FAILSAFE_SCHEMA keeps them as
// strings end-to-end (1 → "1", 1.2 → "1.2", 1.2.3 → "1.2.3").
const E2E_EXACT_WBS = '1.2.3';
const E2E_EXACT_EMAIL = 'e2e-exact@example.com';
const E2E_CHILD_WBS = '1.2';          // grandchild lookup falls back here, not to '1'
const E2E_CHILD_EMAIL = 'e2e-child@example.com';
const E2E_ROOT_EMAIL = 'e2e-root@example.com';

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Fills and submits the NCR creation form as the default (PRIMARY) persona. */
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
  test('exact WBS match notifies the registered contact on submission', async ({ page }) => {
    const ncrId = await createNcrWithWbsNumber(page, E2E_EXACT_WBS);

    await expect(page.locator('#wbs-notification-warning')).toBeHidden();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['events'] });
    const initialEvent = ncr.events.find(e => e.event_type === 'notification.initial');
    expect(initialEvent).toBeTruthy();
    const emails = initialEvent.recipients.map(r => r.recipient_email);
    expect(emails).toContain(E2E_EXACT_EMAIL);
  });

  test('nearest ancestor WBS match notifies the closer registered parent, not a more distant one', async ({ page }) => {
    // 1.2 is registered, 1 is registered, 1.2.4 is NOT registered — falls back to 1.2 (not 1)
    const grandchildWbs = `${E2E_CHILD_WBS}.4`;
    const ncrId = await createNcrWithWbsNumber(page, grandchildWbs);

    await expect(page.locator('#wbs-notification-warning')).toBeHidden();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['events'] });
    const initialEvent = ncr.events.find(e => e.event_type === 'notification.initial');
    const emails = initialEvent.recipients.map(r => r.recipient_email);
    expect(emails).toContain(E2E_CHILD_EMAIL);
    expect(emails).not.toContain(E2E_ROOT_EMAIL);
  });

  test('no match anywhere in the hierarchy warns the Originator without blocking NCR creation', async ({ page }) => {
    const id = runId();
    const wbsNumber = `unregistered.${id}.9.9.9`;

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
