const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// The primary persona (dong, per e2e/fixtures/env.js / PRIMARY_AUTH_STATE) is
// the CE/CS on every NCR this file creates, so the default logged-in page
// fixture can drive the disposition UI directly without opting into a second
// identity. The Originator is a different real user (guobao) purely so the
// two roles are visibly distinct in the fixture data — nothing here asserts
// on the Originator.
const CE_CS_ID = 'dong';
const CE_CS_DISPLAY_NAME = 'Dong Liu';

const REWORK_REPAIR_TEXT =
  'Rework by lightly sanding the affected edge with 400-grit paper, re-inspect under 10x magnification, and re-verify dimensional tolerance per DWG-E2E-100.';
const PREVENTIVE_ACTION_1 =
  'Update the forming work instruction to specify clamping pressure tolerance and add an in-process check.';
const PREVENTIVE_ACTION_2 =
  'Retrain forming operators on the updated clamping procedure and document completion in the training log.';

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Creates an NCR directly via the fixture CLI (bypassing the UI creation flow, which US1's own spec file already covers), already in Submitted status with dong as CE/CS. */
async function createTestNcr(overrides = {}) {
  const id = runId();
  const { ncrId, ncr_number: ncrNumber } = await execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Disposition Test Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: 'guobao',
      originator_name: 'Guobao Shen',
      ce_cs_id: CE_CS_ID,
      ce_cs_name: CE_CS_DISPLAY_NAME,
      discovery_context: 'incoming_inspection',
      discovery_date: todayIsoDate(),
      description_of_nonconformance: `Disposition test nonconformance description ${id}, exceeding twenty characters.`,
      ...overrides.ncrData,
    },
    status: overrides.status || 'Submitted',
    travelerId: '507f1f77bcf86cd799439000',
    stepNumber: 1,
  });
  return { ncrId, ncrNumber };
}

// Submitting a disposition looks up the shared ncr-qa group to notify QA
// staff. e2e/us1-create-and-submit-ncr.spec.js's AS6 test briefly empties
// that same group (restoring it in a `finally`) to exercise the
// "not configured" error path; since different spec files run in parallel
// workers, a disposition submission here can land in that narrow window and
// see a transient 500 that has nothing to do with this feature. Retrying is
// safe: submission failed, so the NCR is still untouched.
const TRANSIENT_QA_GROUP_RACE = 'NCR-QA group is not configured';

/** Submits the already-filled disposition form via the UI, retrying past the transient ncr-qa race above. */
async function submitDispositionAndWaitForSuccess(page, { retries = 3 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    await page.click('#submit-btn');
    const outcome = await Promise.race([
      page.locator('#disp-success').waitFor({ state: 'visible', timeout: 10000 }).then(() => 'success'),
      page.locator('#disp-error').waitFor({ state: 'visible', timeout: 10000 }).then(() => 'error'),
    ]);
    if (outcome === 'success') return;

    const errorText = await page.locator('#disp-error-msg').innerText();
    if (!errorText.includes(TRANSIENT_QA_GROUP_RACE) || attempt === retries) {
      throw new Error(`Disposition submission failed: ${errorText}`);
    }
    await page.waitForTimeout(500);
  }
}

/** PATCHes the disposition endpoint directly, retrying past the transient ncr-qa race above. */
async function patchDispositionWithRetry(requestContext, ncrId, payload, { retries = 3 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const res = await requestContext.patch(`/api/ncrs/${ncrId}/disposition`, { data: payload });
    if (res.status() !== 500) return res;
    const body = await res.json().catch(() => ({}));
    if (!String(body.message).includes(TRANSIENT_QA_GROUP_RACE) || attempt === retries) return res;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return undefined;
}

test.describe('US2 - CE/CS Performs Engineering Disposition', () => {
  test('AS1 - CE/CS sees all mandatory NCR data on the disposition page', async ({ page }) => {
    const { ncrId } = await createTestNcr();

    await page.goto(`/ncrs/${ncrId}`);
    await page.click('a:has-text("Submit Disposition")');
    await page.waitForURL(new RegExp(`/ncrs/${ncrId}/disposition$`));

    await expect(page.locator('h3')).toContainText('Submit Engineering Disposition');
    await expect(page.locator('.well')).toBeVisible();
  });

  test('AS1b - disposition page summary box shows Supplier, WBS, Context, and Description', async ({ page }) => {
    const id = runId();
    const { ncrId } = await createTestNcr({
      ncrData: {
        supplier_name: `Summary Supplier ${id}`,
        wbs_number: `Summary WBS ${id}`,
        description_of_nonconformance: `Summary description of nonconformance ${id}, exceeding twenty characters.`,
      },
    });

    await page.goto(`/ncrs/${ncrId}/disposition`);

    const summary = page.locator('.well');
    await expect(summary).toContainText(`Summary Supplier ${id}`);
    await expect(summary).toContainText(`Summary WBS ${id}`);
    await expect(summary).toContainText('incoming inspection');
    await expect(summary).toContainText(`Summary description of nonconformance ${id}`);
  });

  test('AS2 - disposition form exposes all mandatory fields', async ({ page }) => {
    const { ncrId } = await createTestNcr();
    await page.goto(`/ncrs/${ncrId}/disposition`);

    const radios = page.locator('input[name="parts_disposition"]');
    await expect(radios).toHaveCount(5);
    for (const opt of ['Rework', 'Repair', 'Return to Vendor', 'Scrap', 'Use-As-Is']) {
      await expect(page.locator(`input[name="parts_disposition"][value="${opt}"]`)).toHaveCount(1);
    }

    await expect(page.locator('#root_cause_documentation')).toHaveCount(0);
    await expect(page.locator('.pa-textarea')).toHaveCount(1);
    await expect(page.locator('#add-pa')).toBeVisible();
    await expect(page.locator('#rework-repair-field')).toBeHidden();
  });

  test('AS3 - selecting Rework reveals the instructions field, and submitting without it is blocked with the NCR left Submitted', async ({ page }) => {
    const { ncrId } = await createTestNcr();
    await page.goto(`/ncrs/${ncrId}/disposition`);

    await page.check('input[name="parts_disposition"][value="Rework"]');
    await expect(page.locator('#rework-repair-field')).toBeVisible();

    await page.locator('.pa-textarea').first().fill(PREVENTIVE_ACTION_1);
    // Rework/Repair Instructions intentionally left empty.
    await page.click('#submit-btn');

    await expect(page.locator('#disp-error')).toBeVisible();
    await expect(page.locator('#disp-error-msg')).toContainText(
      'Rework/Repair Instructions is required when Rework or Repair is selected.'
    );
    await expect(page.locator('#disp-success')).toBeHidden();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status'] });
    expect(ncr.status).toBe('Submitted');
  });

  test('AS4/AS5 - full submission records the disposition, transitions the NCR to Dispositioned, and both Preventive Actions start Open', async ({ page }) => {
    const { ncrId } = await createTestNcr();
    await page.goto(`/ncrs/${ncrId}/disposition`);

    await page.check('input[name="parts_disposition"][value="Rework"]');
    await page.fill('#rework_repair_instructions', REWORK_REPAIR_TEXT);
    await page.locator('.pa-textarea').nth(0).fill(PREVENTIVE_ACTION_1);
    await page.click('#add-pa');
    await page.locator('.pa-textarea').nth(1).fill(PREVENTIVE_ACTION_2);

    await submitDispositionAndWaitForSuccess(page);

    await expect(page.locator('#disp-success')).toBeVisible();
    await expect(page.locator('#disp-success')).toContainText('Disposition submitted.');
    await expect(page.locator('#disp-success')).toContainText(
      'QA Staff have been notified for concurrence review.'
    );

    await page.click('#disp-detail-link');
    await page.waitForURL(new RegExp(`/ncrs/${ncrId}$`));

    await expect(page.locator('.badge-Dispositioned')).toContainText('Dispositioned');

    const dispositionSection = page.getByRole('group', { name: 'Disposition', exact: true });
    await expect(dispositionSection).toContainText('Rework');
    await expect(dispositionSection).toContainText(REWORK_REPAIR_TEXT);

    const paWells = page.locator('[data-pa-id]');
    await expect(paWells).toHaveCount(2);
    await expect(paWells.nth(0)).toContainText(PREVENTIVE_ACTION_1);
    await expect(paWells.nth(0).locator('.pa-status-badge')).toHaveText('Open');
    await expect(paWells.nth(1)).toContainText(PREVENTIVE_ACTION_2);
    await expect(paWells.nth(1).locator('.pa-status-badge')).toHaveText('Open');

    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['status', 'disposition', 'preventive_actions', 'events'],
    });
    expect(ncr.status).toBe('Dispositioned');
    expect(ncr.disposition.parts_disposition).toBe('Rework');
    expect(ncr.disposition.rework_repair_instructions).toBe(REWORK_REPAIR_TEXT);
    expect(ncr.disposition.ce_cs_identity).toBe(CE_CS_ID);
    expect(ncr.disposition.ce_cs_timestamp).toBeTruthy();

    expect(ncr.preventive_actions).toHaveLength(2);
    expect(ncr.preventive_actions[0].action_description).toBe(PREVENTIVE_ACTION_1);
    expect(ncr.preventive_actions[0].status).toBe('Open');
    expect(ncr.preventive_actions[1].action_description).toBe(PREVENTIVE_ACTION_2);
    expect(ncr.preventive_actions[1].status).toBe('Open');

    const dispositionEvent = ncr.events.find(e => e.event_type === 'disposition.submitted');
    expect(dispositionEvent).toBeTruthy();
    expect(dispositionEvent.actor_id).toBe(CE_CS_ID);

    const qaNotificationEvent = ncr.events.find(e => e.event_type === 'notification.qa_notification');
    expect(qaNotificationEvent).toBeTruthy();
  });

  test('AS4c - Preventive Actions and Rework/Repair Instructions of any length are accepted (no minimum character requirement)', async ({ page }) => {
    const { ncrId } = await createTestNcr();
    await page.goto(`/ncrs/${ncrId}/disposition`);

    await page.check('input[name="parts_disposition"][value="Rework"]');
    await page.fill('#rework_repair_instructions', 'Sand it.');
    await page.locator('.pa-textarea').first().fill('Fix it.');

    await submitDispositionAndWaitForSuccess(page);

    await expect(page.locator('#disp-success')).toBeVisible();

    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['status', 'disposition', 'preventive_actions'],
    });
    expect(ncr.status).toBe('Dispositioned');
    expect(ncr.disposition.rework_repair_instructions).toBe('Sand it.');
    expect(ncr.preventive_actions[0].action_description).toBe('Fix it.');
  });

  test('AS4b - submission succeeds with zero Preventive Actions (field is optional)', async ({ page }) => {
    const { ncrId } = await createTestNcr();
    await page.goto(`/ncrs/${ncrId}/disposition`);

    await page.check('input[name="parts_disposition"][value="Use-As-Is"]');
    // The default Preventive Action textarea is intentionally left blank.

    await submitDispositionAndWaitForSuccess(page);

    await expect(page.locator('#disp-success')).toBeVisible();

    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['status', 'preventive_actions'],
    });
    expect(ncr.status).toBe('Dispositioned');
    expect(ncr.preventive_actions).toHaveLength(0);
  });

  test('server accepts a disposition payload that omits preventive_actions entirely', async ({ page }) => {
    // Defense-in-depth: verifies routes/ncr.js accepts a missing
    // preventive_actions key directly, bypassing the browser form.
    const { ncrId } = await createTestNcr();

    const res = await patchDispositionWithRetry(page.request, ncrId, {
      parts_disposition: 'Use-As-Is',
    });

    expect(res.status()).toBe(200);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'preventive_actions'] });
    expect(ncr.status).toBe('Dispositioned');
    expect(ncr.preventive_actions).toHaveLength(0);
  });

  test('server rejects an invalid disposition payload independent of client-side checks', async ({ page }) => {
    // Defense-in-depth: verifies routes/ncr.js's own field validation
    // directly, bypassing the browser form entirely, so a regression there is
    // caught even if the UI layer's checks are ever relaxed.
    const { ncrId } = await createTestNcr();

    const res = await page.request.patch(`/api/ncrs/${ncrId}/disposition`, {
      data: {
        parts_disposition: 'Rework',
        preventive_actions: [''],
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.details).toHaveProperty('preventive_actions');
    expect(body.details).toHaveProperty('rework_repair_instructions');

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status'] });
    expect(ncr.status).toBe('Submitted');
  });

  test('a second disposition submission against an already-Dispositioned NCR is rejected (FR-023 one-time-only constraint)', async ({ page }) => {
    const { ncrId } = await createTestNcr();
    const payload = {
      parts_disposition: 'Use-As-Is',
      preventive_actions: [PREVENTIVE_ACTION_1],
    };

    const first = await patchDispositionWithRetry(page.request, ncrId, payload);
    expect(first.status()).toBe(200);

    const second = await page.request.patch(`/api/ncrs/${ncrId}/disposition`, { data: payload });
    expect(second.status()).toBe(409);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status'] });
    expect(ncr.status).toBe('Dispositioned');
  });

  test('a user who is not the assigned CE/CS cannot submit disposition', async ({ browser }) => {
    const { ncrId } = await createTestNcr();

    const otherPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    const res = await otherPage.request.patch(`/api/ncrs/${ncrId}/disposition`, {
      data: {
        parts_disposition: 'Use-As-Is',
        preventive_actions: [PREVENTIVE_ACTION_1],
      },
    });
    expect(res.status()).toBe(403);
    await otherPage.close();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status'] });
    expect(ncr.status).toBe('Submitted');
  });
});
