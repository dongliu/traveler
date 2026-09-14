const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// The primary persona (dong, per e2e/fixtures/env.js / PRIMARY_AUTH_STATE) is
// used as the traveler's owner (createdBy) throughout this file, so the
// default logged-in page fixture can drive the real traveler UI (typing a
// value, clicking Save, clicking "Initiate NCR") directly. SECONDARY_AUTH_STATE
// (bob) is used only to prove read-only visibility of the link/status —
// publicAccess: 0 (this app's actual default) grants any authenticated user
// read access to a traveler while restricting writes to its owner.

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Creates a real, writable traveler with one fillable text input via the fixture CLI. */
async function createFillableTraveler(overrides = {}) {
  const id = runId();
  const { travelerId } = await execFixtureCli('create-fillable-traveler', {
    createdBy: 'dong',
    title: `E2E Fillable Traveler ${id}`,
    inputName: 'field_1',
    inputLabel: `Field One ${id}`,
    ...overrides,
  });
  return { travelerId, inputLabel: overrides.inputLabel || `Field One ${id}` };
}

/** Fills in the traveler's one input via the real UI and clicks Save, waiting for the success message. */
async function fillAndSaveInput(page, value) {
  await page.fill('input[name="field_1"]', value);
  await page.click('button[value="save"]');
  await expect(page.locator('#message .alert-success').last()).toBeVisible({ timeout: 10000 });
}

/** Completes NCR creation on whatever page /ncrs/new the "Initiate NCR" link opened, with the given part number. */
async function completeNcrCreation(page, partNumber) {
  await page.fill('#part_name', `Linked Part ${partNumber}`);
  await page.fill('#part_number', partNumber);
  await page.fill('#part_revision', 'A');
  await page.fill('#quantity', '1');
  await page.fill('#supplier_name', `Supplier ${partNumber}`);
  await page.fill('#wbs_number', `WBS-${partNumber}`);
  await page.fill('#ce_cs_name', 'Bob Dalesio');
  await page.waitForSelector('.tt-suggestion', { timeout: 5000 }).catch(() => {});
  await page.fill('#discovery_date', todayIsoDate());
  await page.check('input[name="discovery_context"][value="incoming_inspection"]');
  await page.fill('#description_of_nonconformance', `Nonconformance found on ${partNumber}, exceeding twenty characters.`);
  await page.click('#submit-btn');
  await expect(page.locator('#ncr-success')).toBeVisible({ timeout: 10000 });
  const href = await page.locator('#ncr-number-link').getAttribute('href');
  return href.split('/').pop();
}

test.describe('Traveler-Initiated NCRs Linked to a Specific Input', () => {
  test('AS1 - no Initiate NCR action until the input has a value; appears immediately after Save with no reload', async ({ page }) => {
    const { travelerId } = await createFillableTraveler();
    await page.goto(`/travelers/${travelerId}/`);

    await expect(page.locator('.initiate-ncr-link')).toHaveCount(0);

    await fillAndSaveInput(page, 'a measured value');

    await expect(page.locator('.initiate-ncr-link')).toBeVisible();
  });

  test('AS2 - Initiate NCR opens creation pre-linked, banner names the input, and the created NCR carries the traveler_link', async ({ page }) => {
    const { travelerId, inputLabel } = await createFillableTraveler();
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'a measured value');

    await page.click('.initiate-ncr-link');
    await page.waitForURL(/\/ncrs\/new\?/);

    await expect(page.locator('#traveler-link-banner')).toBeVisible();
    await expect(page.locator('#traveler-link-banner')).toContainText(inputLabel);

    const id = runId();
    const ncrId = await completeNcrCreation(page, `PN-${id}`);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['traveler_link'] });
    expect(ncr.traveler_link.traveler_id).toBe(travelerId);
    expect(ncr.traveler_link.input_name).toBe('field_1');
    expect(ncr.traveler_link.input_label).toBe(inputLabel);
    expect(ncr.traveler_link.initiated_from_traveler).toBe(true);
  });

  test('AS3 - the traveler shows a link + live status for a linked NCR, and reflects a later status change', async ({ page }) => {
    const { travelerId } = await createFillableTraveler();
    const id = runId();
    const { ncrId, ncr_number: ncrNumber } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: {
        part_name: `Linked Part ${id}`,
        part_number: `PN-${id}`,
        wbs_number: `WBS-${id}`,
        supplier_name: `Supplier ${id}`,
        originator_id: 'dong',
        originator_name: 'Dong Liu',
        description_of_nonconformance: `Nonconformance found ${id}, exceeding twenty characters.`,
      },
      status: 'Submitted',
      travelerId,
      inputName: 'field_1',
    });

    await page.goto(`/travelers/${travelerId}/`);
    const badge = page.locator('.ncr-link-badge');
    await expect(badge).toContainText(ncrNumber);
    await expect(badge).toContainText('Submitted');

    await execFixtureCli('set-ce-cs', { ncrId, ceCsId: 'dong', ceCsName: 'Dong Liu' });
    const dispRes = await page.request.patch(`/api/ncrs/${ncrId}/disposition`, {
      data: { parts_disposition: 'Use-As-Is' },
    });
    expect(dispRes.status()).toBe(200);

    await page.goto(`/travelers/${travelerId}/`);
    await expect(page.locator('.ncr-link-badge')).toContainText('Dispositioned');
  });

  test('AS4 - a second NCR from the same input is never blocked; both show distinctly', async ({ page }) => {
    const { travelerId } = await createFillableTraveler();
    const idA = runId();
    const idB = runId();
    const { ncr_number: ncrNumberA } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: { part_name: `A ${idA}`, part_number: `PN-${idA}`, wbs_number: `WBS-${idA}`, supplier_name: `Supplier ${idA}` },
      travelerId,
      inputName: 'field_1',
    });
    const { ncr_number: ncrNumberB } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: { part_name: `B ${idB}`, part_number: `PN-${idB}`, wbs_number: `WBS-${idB}`, supplier_name: `Supplier ${idB}` },
      travelerId,
      inputName: 'field_1',
    });

    await page.goto(`/travelers/${travelerId}/`);
    const badges = page.locator('.ncr-link-badge');
    await expect(badges).toHaveCount(2);
    const text = await badges.allTextContents();
    expect(text.join(' ')).toContain(ncrNumberA);
    expect(text.join(' ')).toContain(ncrNumberB);
  });

  test('AS5 - the NCR detail page shows the traveler link + input label; a standalone NCR shows neither', async ({ page }) => {
    const { travelerId, inputLabel } = await createFillableTraveler();
    const id = runId();
    const { ncrId } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: { part_name: `Linked ${id}`, part_number: `PN-${id}`, wbs_number: `WBS-${id}`, supplier_name: `Supplier ${id}` },
      travelerId,
      inputName: 'field_1',
      inputLabel,
    });

    await page.goto(`/ncrs/${ncrId}`);
    await expect(page.locator('a:has-text("View Traveler")')).toHaveAttribute('href', new RegExp(`/travelers/${travelerId}/$`));
    await expect(page.locator('body')).toContainText(inputLabel);

    const { ncrId: standaloneNcrId } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: {
        part_name: `Standalone ${id}`,
        part_number: `PN-standalone-${id}`,
        wbs_number: `WBS-${id}`,
        supplier_name: `Supplier ${id}`,
      },
    });
    await page.goto(`/ncrs/${standaloneNcrId}`);
    await expect(page.locator('a:has-text("View Traveler")')).toHaveCount(0);
  });

  test('AS6 - a non-owner with read access still sees the linked NCR link/status; two travelers sharing an input name never cross-link', async ({ page, browser }) => {
    const { travelerId: travelerA } = await createFillableTraveler();
    const { travelerId: travelerB } = await createFillableTraveler();
    const id = runId();
    const { ncr_number: ncrNumberA } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: { part_name: `A ${id}`, part_number: `PN-a-${id}`, wbs_number: `WBS-${id}`, supplier_name: `Supplier ${id}` },
      travelerId: travelerA,
      inputName: 'field_1',
    });

    // Traveler B never had an NCR initiated from its (identically-named) field_1.
    await page.goto(`/travelers/${travelerB}/`);
    await expect(page.locator('.ncr-link-badge')).toHaveCount(0);

    const nonOwnerPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await nonOwnerPage.goto(`/travelers/${travelerA}/`);
    await expect(nonOwnerPage.locator('.ncr-link-badge')).toContainText(ncrNumberA);
    await nonOwnerPage.close();
  });
});
