const { test, expect, request } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { createMailpitClient, normalizeWhitespace } = require('./fixtures/mailpit');
const { resolveEnv } = require('./fixtures/env');
const { PRIMARY_AUTH_STATE, SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

const env = resolveEnv();

// The primary persona (dong, per e2e/fixtures/env.js) is the Originator on
// every NCR this file creates. The secondary persona (bob) plays the
// Designate in most scenarios, since it's a real, already-authenticatable
// identity (research.md Decision 4) — this also lets AS3 log in as the
// Designate to prove even they cannot manage their own assignment.
const DESIGNATE_ID = 'bob';
const DESIGNATE_DISPLAY_NAME = 'Bob Dalesio';
const DESIGNATE_EMAIL = 'bob@example.com';

// A third real user, used only as the replacement target in AS4 — never
// logged in as.
const ALT_DESIGNATE_DISPLAY_NAME = 'Guobao Shen';
const ALT_DESIGNATE_ID = 'guobao';

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Creates an NCR directly via the fixture CLI (bypassing the UI creation flow, which US1's own spec file already covers) with dong as Originator. */
async function createTestNcr(overrides = {}) {
  const id = runId();
  const { ncrId, ncr_number: ncrNumber } = await execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Designate Test Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: 'dong',
      originator_name: 'Dong Liu',
      discovery_context: 'incoming_inspection',
      discovery_date: todayIsoDate(),
      description_of_nonconformance: `Designate test nonconformance description ${id}.`,
      ...overrides.ncrData,
    },
    status: overrides.status || 'Submitted',
    travelerId: '507f1f77bcf86cd799439000',
    stepNumber: 1,
  });
  return { ncrId, ncrNumber };
}

/** Drives the real Designate assignment UI on the NCR detail page (Originator-only control). */
async function assignViaUi(page, ncrId, displayName) {
  await page.goto(`/ncrs/${ncrId}`);
  await page.click('#designate-toggle');
  await page.waitForSelector('#designate-form', { state: 'visible' });
  await page.fill('#designate-name-input', displayName);
  await page.waitForSelector('.tt-suggestion', { timeout: 5000 }).catch(() => {});
  await page.click('#designate-submit-btn');
}

test.describe('Originator Designate - assign and remove', () => {
  test('AS1 - Originator assigns a Designate: UI updates, notification email sent, event recorded', async ({ page }) => {
    const { ncrId, ncrNumber } = await createTestNcr();

    await assignViaUi(page, ncrId, DESIGNATE_DISPLAY_NAME);

    await expect(page.locator('#designate-display')).toContainText(DESIGNATE_DISPLAY_NAME, { timeout: 10000 });
    await expect(page.locator('#designate-remove-btn')).toBeVisible();
    await expect(page.locator('#designate-toggle')).toHaveText('Change');

    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['originator_designate_id', 'originator_designate_name', 'events'],
    });
    expect(ncr.originator_designate_id).toBe(DESIGNATE_ID);
    expect(ncr.originator_designate_name).toBe(DESIGNATE_DISPLAY_NAME);

    const assignedEvent = ncr.events.find(e => e.event_type === 'delegate.assigned');
    expect(assignedEvent).toBeTruthy();
    expect(assignedEvent.actor_id).toBe('dong');
    expect(assignedEvent.payload.designate_id).toBe(DESIGNATE_ID);

    const notificationEvent = ncr.events.find(e => e.event_type === 'notification.designate_assigned');
    expect(notificationEvent).toBeTruthy();
    expect(notificationEvent.recipients[0].recipient_email).toBe(DESIGNATE_EMAIL);
    expect(notificationEvent.recipients[0].delivery_status).toBe('Delivered');

    const apiContext = await request.newContext();
    const mailpitClient = createMailpitClient(apiContext, env.mailBaseUrl);
    const message = await mailpitClient.waitForMessage(`to:"${DESIGNATE_EMAIL}" subject:"${ncrNumber}"`);
    const full = await mailpitClient.getMessage(message.ID);
    const bodyText = normalizeWhitespace(full.Text);
    expect(bodyText).toContain(ncrNumber);
    expect(bodyText).toContain('Designate');
    await apiContext.dispose();
  });

  test('AS2 - rejects self-assignment with a clear error and makes no change', async ({ page }) => {
    const { ncrId } = await createTestNcr();

    await page.goto(`/ncrs/${ncrId}`);
    await page.click('#designate-toggle');
    await page.waitForSelector('#designate-form', { state: 'visible' });
    await page.fill('#designate-name-input', 'Dong Liu');
    await page.waitForSelector('.tt-suggestion', { timeout: 5000 }).catch(() => {});
    await page.click('#designate-submit-btn');

    await expect(page.locator('#designate-error')).toBeVisible();
    await expect(page.locator('#designate-error-msg')).toContainText(
      'Cannot assign the Originator as their own Designate'
    );

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['originator_designate_id'] });
    expect(ncr.originator_designate_id).toBeFalsy();
  });

  test('AS3 - only the Originator can assign/change/remove: the UI hides the control from others, and the API rejects direct calls even from the current Designate', async ({ browser }) => {
    const { ncrId } = await createTestNcr();

    // Set up: assign bob as Designate via the real flow (as the Originator).
    const originatorPage = await browser.newPage({ storageState: PRIMARY_AUTH_STATE });
    await assignViaUi(originatorPage, ncrId, DESIGNATE_DISPLAY_NAME);
    await expect(originatorPage.locator('#designate-display')).toContainText(DESIGNATE_DISPLAY_NAME, { timeout: 10000 });
    await originatorPage.close();

    // As bob — the current Designate, not the Originator:
    const designatePage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await designatePage.goto(`/ncrs/${ncrId}`);

    // The assignment control is Originator-only — bob shouldn't see it at all.
    await expect(designatePage.locator('#designate-toggle')).toHaveCount(0);
    await expect(designatePage.locator('#designate-remove-btn')).toHaveCount(0);

    // Direct API calls must be rejected too, not just hidden client-side.
    const changeRes = await designatePage.request.patch(`/api/ncrs/${ncrId}/designate`, {
      data: { designate_id: ALT_DESIGNATE_ID, designate_name: ALT_DESIGNATE_DISPLAY_NAME, designate_email: 'guobao@example.com' },
    });
    expect(changeRes.status()).toBe(403);

    const removeRes = await designatePage.request.patch(`/api/ncrs/${ncrId}/designate`, { data: {} });
    expect(removeRes.status()).toBe(403);

    await designatePage.close();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['originator_designate_id'] });
    expect(ncr.originator_designate_id).toBe(DESIGNATE_ID);
  });

  test('AS4 - Originator replaces an existing Designate with a different one', async ({ page }) => {
    const { ncrId } = await createTestNcr();

    await assignViaUi(page, ncrId, DESIGNATE_DISPLAY_NAME);
    await expect(page.locator('#designate-display')).toContainText(DESIGNATE_DISPLAY_NAME, { timeout: 10000 });

    await assignViaUi(page, ncrId, ALT_DESIGNATE_DISPLAY_NAME);
    await expect(page.locator('#designate-display')).toContainText(ALT_DESIGNATE_DISPLAY_NAME, { timeout: 10000 });
    await expect(page.locator('#designate-display')).not.toContainText(DESIGNATE_DISPLAY_NAME);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['originator_designate_id', 'originator_designate_name'] });
    expect(ncr.originator_designate_id).toBe(ALT_DESIGNATE_ID);
    expect(ncr.originator_designate_name).toBe(ALT_DESIGNATE_DISPLAY_NAME);
  });

  test('AS5 - Originator removes the Designate', async ({ page }) => {
    const { ncrId } = await createTestNcr();

    await assignViaUi(page, ncrId, DESIGNATE_DISPLAY_NAME);
    await expect(page.locator('#designate-display')).toContainText(DESIGNATE_DISPLAY_NAME, { timeout: 10000 });

    page.once('dialog', d => d.accept());
    await page.click('#designate-remove-btn');
    await expect(page.locator('#designate-display')).not.toContainText(DESIGNATE_DISPLAY_NAME, { timeout: 10000 });

    await expect(page.locator('#designate-display')).toContainText('None');
    await expect(page.locator('#designate-remove-btn')).toHaveCount(0);
    await expect(page.locator('#designate-toggle')).toHaveText('Assign');

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['originator_designate_id', 'events'] });
    expect(ncr.originator_designate_id).toBeFalsy();

    const removedEvent = ncr.events.find(e => e.event_type === 'delegate.removed');
    expect(removedEvent).toBeTruthy();
    expect(removedEvent.payload.previous_designate_id).toBe(DESIGNATE_ID);
  });

  test('AS6 - rejects assign/change/remove on a Closed NCR', async ({ page }) => {
    const { ncrId } = await createTestNcr({ status: 'Closed' });

    const assignRes = await page.request.patch(`/api/ncrs/${ncrId}/designate`, {
      data: { designate_id: DESIGNATE_ID, designate_name: DESIGNATE_DISPLAY_NAME, designate_email: DESIGNATE_EMAIL },
    });
    expect(assignRes.status()).toBe(409);

    const removeRes = await page.request.patch(`/api/ncrs/${ncrId}/designate`, { data: {} });
    expect(removeRes.status()).toBe(409);

    // The Originator-only assignment control itself should also not be
    // offered in the UI for a Closed NCR (T006's status gate).
    await page.goto(`/ncrs/${ncrId}`);
    await expect(page.locator('#designate-toggle')).toHaveCount(0);
  });
});
