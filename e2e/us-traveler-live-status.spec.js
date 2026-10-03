const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { fillAndSaveInput } = require('./fixtures/ncr-ui');

// Spec 125 User Story 5 — an open, active traveler page pulls the state of its
// inputs and NCRs every 30 seconds. These tests wait for real 30-second ticks, so
// each one allows for two of them.

const PRIMARY = 'dong';
const TICK_WAIT = 45000;

test.setTimeout(120000);

async function createTraveler(inputs) {
  const { travelerId } = await execFixtureCli('create-fillable-traveler', {
    createdBy: PRIMARY,
    title: `E2E Live Status ${runId()}`,
    inputs,
  });
  return travelerId;
}

function textInputs(id) {
  return [
    { name: 'input_a', label: `Input A ${id}` },
    { name: 'input_b', label: `Input B ${id}` },
    { name: 'input_c', label: `Input C ${id}` },
  ];
}

function unitOf(page, name) {
  return page
    .locator('#form .controls')
    .filter({ has: page.locator(`[name="${name}"]`) })
    .last();
}

async function linkNcr(travelerId, inputName, inputLabel, status) {
  const id = runId();
  return execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Linked Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: 'dong',
      originator_name: 'Dong Liu',
      description_of_nonconformance: `Nonconformance found ${id}, exceeding twenty characters.`,
    },
    status,
    travelerId,
    inputName,
    inputLabel,
  });
}

test.describe('US5 — the traveler page refreshes its live status every 30 seconds', () => {
  test('an NCR closed elsewhere lets the submit button through, without a reload', async ({ page }) => {
    const id = runId();
    const travelerId = await createTraveler(textInputs(id));
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_a', 'a');
    await fillAndSaveInput(page, 'input_b', 'b');
    await fillAndSaveInput(page, 'input_c', 'c');
    const { ncrId } = await linkNcr(travelerId, 'input_b', `Input B ${id}`, 'Submitted');
    await page.reload();
    await expect(page.locator('#complete2')).toBeDisabled();

    await execFixtureCli('set-ncr-status', { ncrId, status: 'Closed' });

    await expect(page.locator('#complete2')).toBeEnabled({ timeout: TICK_WAIT });
  });

  test('a value saved elsewhere shows on the open page, and text being typed here is kept', async ({ page }) => {
    const id = runId();
    const travelerId = await createTraveler(textInputs(id));
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_a', 'first');

    // this user is in the middle of entering input C
    await unitOf(page, 'input_c').locator('.input-value-link').click();
    await page.fill('input[name="input_c"]', 'half typed');

    // another session saves input A
    const res = await page.request.post(`/travelers/${travelerId}/data/`, {
      data: { name: 'input_a', value: 'saved elsewhere', type: 'text' },
    });
    expect(res.status()).toBe(204);

    await expect(page.locator('input[name="input_a"]')).toHaveValue('saved elsewhere', { timeout: TICK_WAIT });
    await expect(page.locator('input[name="input_c"]')).toHaveValue('half typed');
    await expect(page.locator('input[name="input_c"]')).toBeEnabled();
  });

  test('a traveler that stops being active loses its input options and its submit button on the next refresh', async ({ page }) => {
    const id = runId();
    const travelerId = await createTraveler(textInputs(id));
    await page.goto(`/travelers/${travelerId}/`);
    await expect(page.locator('.input-value-link')).toHaveCount(3);

    await execFixtureCli('set-traveler-status', { travelerId, status: 1.5 });

    await expect(page.locator('.input-value-link')).toHaveCount(0, { timeout: TICK_WAIT });
    await expect(page.locator('.initiate-ncr-link')).toHaveCount(0);
    await expect(page.locator('#complete2')).toBeDisabled();
  });

  test('a failed refresh keeps the page as it was and shows no error', async ({ page }) => {
    const id = runId();
    const travelerId = await createTraveler(textInputs(id));
    await page.route('**/live-status/', route => route.abort());
    await page.goto(`/travelers/${travelerId}/`);
    await expect(page.locator('.input-value-link')).toHaveCount(3);

    // let at least one refresh fail
    await page.waitForTimeout(TICK_WAIT);

    await expect(page.locator('#message .alert-error')).toHaveCount(0);
    await expect(page.locator('.input-value-link')).toHaveCount(3);
    await expect(page.locator('#complete2')).toBeDisabled();
  });

  test('a traveler that is not active sends no live-status requests', async ({ page }) => {
    const id = runId();
    const travelerId = await createTraveler(textInputs(id));
    await execFixtureCli('set-traveler-status', { travelerId, status: 1.5 });
    let polls = 0;
    page.on('request', request => {
      if (request.url().includes('/live-status/')) {
        polls += 1;
      }
    });

    await page.goto(`/travelers/${travelerId}/`);
    await page.waitForTimeout(TICK_WAIT);

    expect(polls).toBe(0);
  });
});
