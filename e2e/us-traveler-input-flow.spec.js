const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { fillAndSaveInput } = require('./fixtures/ncr-ui');

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

  test('saving stores the value, and locks and completes the input: neither option is offered', async ({ page }) => {
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
    await expect(unitOf(page, 'input_a').locator('.input-value-link')).toHaveCount(0);
    await expect(unitOf(page, 'input_a').locator('.initiate-ncr-link')).toHaveCount(0);
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
  test('an open NCR on an input removes its Input and Initiate NCR options, and shows the NCR', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await linkNcr(travelerId, 'input_b', `Input B ${id}`);
    await page.goto(`/travelers/${travelerId}/`);

    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(0);
    await expect(unitOf(page, 'input_b').locator('.initiate-ncr-link')).toHaveCount(0);
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

  test('closing the NCR brings both Input and Initiate NCR back once the page is refreshed', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    const { ncrId } = await linkNcr(travelerId, 'input_b', `Input B ${id}`);
    await page.goto(`/travelers/${travelerId}/`);
    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(0);
    await expect(unitOf(page, 'input_b').locator('.initiate-ncr-link')).toHaveCount(0);

    await execFixtureCli('set-ncr-status', { ncrId, status: 'Closed' });
    await page.reload();

    await expect(unitOf(page, 'input_b').locator('.input-value-link')).toHaveCount(1);
    await expect(unitOf(page, 'input_b').locator('.initiate-ncr-link')).toHaveCount(1);
  });

  test('an open NCR on an input that is still empty leaves no way to raise a second one', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await linkNcr(travelerId, 'input_c', `Input C ${id}`);
    await page.goto(`/travelers/${travelerId}/`);

    await expect(unitOf(page, 'input_c').locator('.initiate-ncr-link')).toHaveCount(0);
    await expect(unitOf(page, 'input_c').locator('.input-value-link')).toHaveCount(0);
    await expect(unitOf(page, 'input_c').locator('.ncr-link-badge')).toHaveCount(1);
    // an input with no NCR still offers both
    await expect(unitOf(page, 'input_a').locator('.initiate-ncr-link')).toHaveCount(1);
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

/** Three text inputs (A, B, C): a traveler that is quick to fill in. */
function textInputs(id) {
  return [
    { name: 'input_a', label: `Input A ${id}` },
    { name: 'input_b', label: `Input B ${id}` },
    { name: 'input_c', label: `Input C ${id}` },
  ];
}

async function travelerStatus(travelerId) {
  return (await execFixtureCli('get-traveler', { travelerId })).status;
}

async function apiContext(playwright) {
  const { resolveEnv } = require('./fixtures/env');
  const { apiBaseUrl } = resolveEnv();
  const password = require('../docker/api.json').api_users.api_write;
  return playwright.request.newContext({
    baseURL: apiBaseUrl,
    extraHTTPHeaders: {
      Authorization: `Basic ${Buffer.from(`api_write:${password}`).toString('base64')}`,
    },
  });
}

test.describe('US4 — submission needs every NCR closed and every input filled in', () => {
  test('Submit for completion is disabled while an input has no value, and names the input', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: textInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    await expect(page.locator('#complete2')).toBeDisabled();
    await expect(page.locator('#submit-blockers')).toContainText(`Input A ${id}`);
  });

  test('Submit lists each open NCR with a link, and enables once the NCR is Closed', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: textInputs(id) });
    // every input is filled first, so the only reason left is the open NCR
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_a', 'a');
    await fillAndSaveInput(page, 'input_b', 'b');
    await fillAndSaveInput(page, 'input_c', 'c');
    const { ncrId, ncr_number: ncrNumber } = await linkNcr(travelerId, 'input_b', `Input B ${id}`);
    await page.reload();

    await expect(page.locator('#complete2')).toBeDisabled();
    await expect(page.locator('#submit-blockers')).toContainText(ncrNumber);
    await expect(page.locator('#submit-blockers a[href*="/ncrs/"]')).toHaveCount(1);

    await execFixtureCli('set-ncr-status', { ncrId, status: 'Closed' });
    await page.reload();
    await expect(page.locator('#complete2')).toBeEnabled();
  });

  test('Submit is disabled while an input is being entered, and enabled once that input is saved', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: textInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_b', 'b');
    await fillAndSaveInput(page, 'input_c', 'c');
    // input A has no value yet, so submission is not offered
    await expect(page.locator('#complete2')).toBeDisabled();

    await unitOf(page, 'input_a').locator('.input-value-link').click();
    await page.fill('input[name="input_a"]', 'changed but not saved');
    await expect(page.locator('#complete2')).toBeDisabled();
    await expect(page.locator('#submit-blockers')).toContainText('save or reset it first');

    await page.click('button[value="save"]');
    await expect(page.locator('#complete2')).toBeEnabled();
  });

  test('when every input has a value and every NCR is Closed, submission goes through', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: textInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_a', 'a');
    await fillAndSaveInput(page, 'input_b', 'b');
    await fillAndSaveInput(page, 'input_c', 'c');

    await expect(page.locator('#complete2')).toBeEnabled();
    await page.click('#complete2');
    await expect.poll(() => travelerStatus(travelerId), { timeout: 15000 }).toBe(1.5);
  });

  test('the REST API refuses a submission while an input is empty, and accepts it once every input has a value', async ({ page, playwright }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: textInputs(id) });
    const api = await apiContext(playwright);

    let res = await api.put(`/apis/travelers/${travelerId}/status/`, {
      data: { status: 1.5, userId: PRIMARY },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('INPUTS_MISSING');
    expect(body.open_ncrs).toEqual([]);
    expect(body.missing_inputs.map(i => i.name)).toEqual(['input_a', 'input_b', 'input_c']);
    expect(await travelerStatus(travelerId)).toBe(1);

    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_a', 'a');
    await fillAndSaveInput(page, 'input_b', 'b');
    await fillAndSaveInput(page, 'input_c', 'c');

    res = await api.put(`/apis/travelers/${travelerId}/status/`, {
      data: { status: 1.5, userId: PRIMARY },
    });
    expect(res.status()).toBe(200);
    expect(await travelerStatus(travelerId)).toBe(1.5);
    await api.dispose();
  });
});

test.describe('US1 — saving nothing does not complete an input', () => {
  test('saving a blank text input or an unticked box keeps both options: the input is not completed', async ({ page }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    // a blank text value
    await chooseInput(page, 'input_a');
    await page.click('button[value="save"]');
    await expect(unitOf(page, 'input_a').locator('.input-value-link')).toBeVisible();
    await expect(unitOf(page, 'input_a').locator('.initiate-ncr-link')).toBeVisible();

    // an unticked single checkbox (saved as false)
    await chooseInput(page, 'check_d');
    await page.click('button[value="save"]');
    await expect(unitOf(page, 'check_d').locator('.input-value-link')).toBeVisible();
    await expect(unitOf(page, 'check_d').locator('.initiate-ncr-link')).toBeVisible();

    // nothing counts as finished, so submission is still held back
    expect((await execFixtureCli('get-traveler', { travelerId })).finishedInput).toBe(0);
  });
});
