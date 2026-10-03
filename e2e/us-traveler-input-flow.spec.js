const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');

// Spec 125 — the traveler input flow: a per-input choice of Input or Initiate
// NCR, the hold on an input with an open NCR, the submission gate, and the
// 30-second live status. Each User Story has its own describe block.

const PRIMARY = 'dong';

/** Creates a real traveler through the fixture CLI. */
async function createTraveler(overrides = {}) {
  const id = runId();
  const { travelerId } = await execFixtureCli('create-fillable-traveler', {
    createdBy: PRIMARY,
    title: `E2E Input Flow ${id}`,
    ...overrides,
  });
  return { travelerId, id };
}

/** Three text inputs (A, B, C) and one checkbox inside a set (D). */
function fourInputs(id) {
  return [
    { name: 'input_a', label: `Input A ${id}` },
    { name: 'input_b', label: `Input B ${id}` },
    { name: 'input_c', label: `Input C ${id}` },
    { name: 'check_d', label: `Check D ${id}`, kind: 'checkbox-in-set' },
  ];
}

/** The counted input unit (its .controls) that holds the named field. */
function unitOf(page, name) {
  return page
    .locator('#form .controls')
    .filter({ has: page.locator(`[name="${name}"]`) })
    .last();
}

/** Chooses Input on one input, if its option is offered. */
async function chooseInput(page, name) {
  const option = unitOf(page, name).locator('.input-value-link');
  await expect(option).toBeVisible();
  await option.click();
}

test.describe('US1 — choose Input or Initiate NCR for each traveler input', () => {
  test('every input offers Input and Initiate NCR, and none is editable until Input is chosen', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    await expect(page.locator('.input-value-link')).toHaveCount(4);
    await expect(page.locator('.initiate-ncr-link')).toHaveCount(4);
    for (const name of ['input_a', 'input_b', 'input_c']) {
      await expect(page.locator(`input[name="${name}"]`)).toBeDisabled();
    }
    await expect(page.locator('input[name="check_d"]')).toBeDisabled();
  });

  test('Input makes that one input editable, hides its Initiate NCR, and offers Save and Reset', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    await chooseInput(page, 'input_b');

    await expect(page.locator('input[name="input_b"]')).toBeEnabled();
    await expect(unitOf(page, 'input_b').locator('.initiate-ncr-link')).toBeHidden();
    await expect(unitOf(page, 'input_b').locator('button[value="save"]')).toBeVisible();
    await expect(unitOf(page, 'input_b').locator('button[value="reset"]')).toBeVisible();
    // one input at a time: the other inputs' options are not usable
    await expect(unitOf(page, 'input_a').locator('.input-value-link')).toBeDisabled();
    await expect(unitOf(page, 'input_a').locator('.initiate-ncr-link')).toHaveClass(/disabled/);
    await expect(page.locator('input[name="input_a"]')).toBeDisabled();
  });

  test('saving stores the value and returns the input to both options', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    await chooseInput(page, 'input_a');
    const successAlerts = page.locator('#message .alert-success');
    const before = await successAlerts.count();
    await page.fill('input[name="input_a"]', 'a measured value');
    await page.click('button[value="save"]');
    await expect(successAlerts).toHaveCount(before + 1, { timeout: 10000 });

    await expect(page.locator('input[name="input_a"]')).toHaveValue('a measured value');
    await expect(page.locator('input[name="input_a"]')).toBeDisabled();
    await expect(unitOf(page, 'input_a').locator('.input-value-link')).toBeVisible();
    await expect(unitOf(page, 'input_a').locator('.initiate-ncr-link')).toBeVisible();
  });

  test('Reset discards the unsaved change and returns the input to both options', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    await chooseInput(page, 'input_c');
    await page.fill('input[name="input_c"]', 'not saved');
    await page.click('button[value="reset"]');

    await expect(page.locator('input[name="input_c"]')).toHaveValue('');
    await expect(page.locator('input[name="input_c"]')).toBeDisabled();
    await expect(unitOf(page, 'input_c').locator('.input-value-link')).toBeVisible();
    await expect(unitOf(page, 'input_c').locator('.initiate-ncr-link')).toBeVisible();
  });

  test('Initiate NCR is offered on an input with no value and links the new NCR to it', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    const link = unitOf(page, 'input_b').locator('.initiate-ncr-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', new RegExp(`traveler_input_ref=${travelerId}%3A%3Ainput_b`));
  });

  test('a traveler that is not active offers neither option on any input', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id), status: 1.5 });
    await page.goto(`/travelers/${travelerId}/`);

    await expect(page.locator('.input-value-link')).toHaveCount(0);
    await expect(page.locator('.initiate-ncr-link')).toHaveCount(0);
  });
});

/** An NCR already linked to one input of the traveler, created through the fixture CLI. */
async function linkNcr(travelerId, inputName, inputLabel, status = 'Submitted') {
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

test.describe('US2 — an input with an open NCR waits until the NCR is closed', () => {
  test('an open NCR on an input removes its Input option, keeps Initiate NCR, and shows the NCR', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await linkNcr(travelerId, 'input_b', `Input B ${id}`);
    await page.goto(`/travelers/${travelerId}/`);

    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(0);
    await expect(unitOf(page, 'input_b').locator('.initiate-ncr-link')).toBeVisible();
    await expect(unitOf(page, 'input_b').locator('.ncr-link-badge')).toBeVisible();
    // the other inputs are unaffected
    await expect(unitOf(page, 'input_a').locator('.input-value-link')).toHaveCount(1);
  });

  test('two NCRs with one still open keep Input held back', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await linkNcr(travelerId, 'input_b', `Input B ${id}`, 'Closed');
    await linkNcr(travelerId, 'input_b', `Input B ${id}`, 'Submitted');
    await page.goto(`/travelers/${travelerId}/`);

    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(0);
  });

  test('a closed NCR does not hold Input back', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await linkNcr(travelerId, 'input_b', `Input B ${id}`, 'Closed');
    await page.goto(`/travelers/${travelerId}/`);

    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(1);
    await expect(unitOf(page, 'input_b').locator('.initiate-ncr-link')).toBeVisible();
  });

  test('closing the NCR brings Input back once the page is refreshed', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    const { ncrId } = await linkNcr(travelerId, 'input_b', `Input B ${id}`);
    await page.goto(`/travelers/${travelerId}/`);
    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(0);

    await execFixtureCli('set-ncr-status', { ncrId, status: 'Closed' });
    await page.reload();

    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(1);
  });
});

test.describe('US3 — NCRs are started from inside a traveler only', () => {
  test('the standalone NCR form has no traveler input field, and no input offers a copy-reference control', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

    await page.goto('/ncrs/new');
    await expect(page.locator('input[name="traveler_input_ref"][type="text"]')).toHaveCount(0);
    await expect(page.locator('#traveler-link-context')).toBeHidden();

    await page.goto(`/travelers/${travelerId}/`);
    await expect(page.locator('.copy-ncr-ref')).toHaveCount(0);
    await expect(page.locator('.input-value-link')).toHaveCount(4);
  });

  test('opening the form from Initiate NCR shows the traveler and input as fixed context', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

    await page.goto(
      `/ncrs/new?traveler_input_ref=${encodeURIComponent(`${travelerId}::input_c`)}`
    );
    await expect(page.locator('#traveler-link-context')).toBeVisible();
    await expect(page.locator('#traveler-link-text')).toContainText(`Input C ${id}`);
    await expect(page.locator('input[type="text"][name="traveler_input_ref"]')).toHaveCount(0);
  });
});
