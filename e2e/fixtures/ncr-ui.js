const { expect } = require('@playwright/test');

/**
 * Small page helpers shared by the traveler-NCR specs (specs 123 and 124):
 * filling a traveler input through the real UI, and completing the real NCR
 * initiation form. (e2e/us-traveler-ncr-input-linking.spec.js still carries
 * its own older copies; consolidating them is out of scope.)
 */

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Types a value into one traveler input and clicks its Save, waiting until a
 * NEW success message appears (counting them, so a second save on the same
 * page is not mistaken for the first one's message).
 */
async function fillAndSaveInput(page, inputName, value) {
  const successAlerts = page.locator('#message .alert-success');
  const before = await successAlerts.count();
  await page.fill(`input[name="${inputName}"]`, value);
  await page.click('button[value="save"]');
  await expect(successAlerts).toHaveCount(before + 1, { timeout: 10000 });
}

/**
 * Fills every required field of the NCR initiation form (on /ncrs/new) but does
 * not submit it. The CE/CS is a persona that exists in the test directory.
 */
async function fillNcrForm(page, partNumber) {
  await page.fill('#part_name', `Linked Part ${partNumber}`);
  await page.fill('#part_number', partNumber);
  await page.fill('#part_revision', 'A');
  await page.fill('#quantity', '1');
  await page.fill('#supplier_name', `Supplier ${partNumber}`);
  await page.fill('#wbs_number', `WBS-${partNumber}`);
  await page.fill('#ce_cs_name', 'Bob Dalesio');
  await page
    .waitForSelector('.tt-suggestion', { timeout: 5000 })
    .catch(() => {});
  await page.fill('#discovery_date', todayIsoDate());
  await page.check(
    'input[name="discovery_context"][value="incoming_inspection"]'
  );
  await page.fill(
    '#description_of_nonconformance',
    `Nonconformance found on ${partNumber}, exceeding twenty characters.`
  );
}

/** Fills and submits the NCR form; resolves to the new NCR's id. */
async function completeNcrCreation(page, partNumber) {
  await fillNcrForm(page, partNumber);
  await page.click('#submit-btn');
  // creating an NCR sends several emails, which is slow when the suite runs its
  // files in parallel
  await expect(page.locator('#ncr-success')).toBeVisible({ timeout: 20000 });
  const href = await page.locator('#ncr-number-link').getAttribute('href');
  return href.split('/').pop();
}

/** A complete, valid POST /api/ncrs body, for tests that go straight to the API. */
function ncrRequestBody(id, overrides = {}) {
  return {
    part_name: `API Part ${id}`,
    part_number: `PN-${id}`,
    part_revision: 'A',
    quantity: 1,
    supplier_name: `Supplier ${id}`,
    wbs_number: `WBS-${id}`,
    ce_cs_name: 'Bob Dalesio',
    discovery_date: todayIsoDate(),
    discovery_context: 'incoming_inspection',
    description_of_nonconformance: `Nonconformance ${id}, exceeding twenty characters.`,
    ...overrides,
  };
}

module.exports = {
  todayIsoDate,
  fillAndSaveInput,
  fillNcrForm,
  completeNcrCreation,
  ncrRequestBody,
};
