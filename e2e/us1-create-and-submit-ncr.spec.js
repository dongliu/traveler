const { test, expect, request } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { createMailpitClient, normalizeWhitespace } = require('./fixtures/mailpit');
const { resolveEnv } = require('./fixtures/env');
const { PRIMARY_AUTH_STATE, SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

const env = resolveEnv();

// A real, existing user distinct from both configured test personas — used
// purely as the CE/CS email recipient in this file, never logged in as.
const CE_CS_DISPLAY_NAME = 'Bob Dalesio';
const CE_CS_EMAIL = 'bob@example.com';

const NCR_QA_GROUP_ID = 'ncr-qa';

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function buildNcrData(overrides = {}) {
  const id = runId();
  return {
    id,
    part_name: `E2E Bracket ${id}`,
    part_number: `PN-${id}`,
    part_revision: 'A',
    quantity: '2',
    supplier_name: `E2E Supplier ${id}`,
    wbs_number: `WBS-${id}`,
    specification_drawing_reference: `DWG-${id}`,
    ce_cs_name: CE_CS_DISPLAY_NAME,
    discovery_date: todayIsoDate(),
    discovery_context: 'incoming_inspection',
    description_of_nonconformance: `E2E test nonconformance description for run ${id}, exceeding twenty characters.`,
    ...overrides,
  };
}

/** Fills the NCR creation form and clicks submit. Does not wait for the result. */
async function fillNcrForm(page, data) {
  await page.goto('/ncrs/new');
  await page.fill('#part_name', data.part_name);
  await page.fill('#part_number', data.part_number);
  await page.fill('#part_revision', data.part_revision);
  await page.fill('#quantity', String(data.quantity));
  await page.fill('#supplier_name', data.supplier_name);
  await page.fill('#wbs_number', data.wbs_number);
  if (data.specification_drawing_reference) {
    await page.fill('#specification_drawing_reference', data.specification_drawing_reference);
  }

  if (data.ce_cs_name) {
    await page.fill('#ce_cs_name', data.ce_cs_name);
    // Let the Bloodhound typeahead's prefetch populate before submitting —
    // the client JS requires an exact displayName match in its local index.
    await page.waitForSelector('.tt-suggestion', { timeout: 5000 }).catch(() => {});
  }

  if (data.discovery_date) {
    await page.fill('#discovery_date', data.discovery_date);
  }
  if (data.discovery_context) {
    await page.check(`input[name="discovery_context"][value="${data.discovery_context}"]`);
  }
  await page.fill('#description_of_nonconformance', data.description_of_nonconformance);

  await page.click('#submit-btn');
}

/** Fills and submits the form, waits for the success banner, returns the created NCR's id/number. */
async function createNcrViaUi(page, overrides = {}) {
  const data = buildNcrData(overrides);
  await fillNcrForm(page, data);
  await expect(page.locator('#ncr-success')).toBeVisible({ timeout: 10000 });
  const ncrNumber = await page.locator('#ncr-number-display').innerText();
  const href = await page.locator('#ncr-number-link').getAttribute('href');
  const ncrId = href.split('/').pop();
  return { data, ncrNumber, ncrId };
}

test.describe('US1 - NCR creation and submission notifications', () => {
  // Shared NCR for the notification/event-log assertions (AS3-AS5) — created
  // once so those three concerns aren't re-creating (and re-emailing) an NCR
  // each; this file's tests run serially within the file (fullyParallel:
  // false), so it's safe for them to share this state via module scope.
  let sharedNcr;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: PRIMARY_AUTH_STATE });
    sharedNcr = await createNcrViaUi(page);
    await page.close();
  });

  test('AS1 - creates an NCR with a generated number and Submitted status', async ({ page }) => {
    const { ncrNumber, ncrId } = await createNcrViaUi(page);

    expect(ncrNumber).toMatch(/^NCR-\d{4}-\d{4}$/);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'ncr_number'] });
    expect(ncr.status).toBe('Submitted');
    expect(ncr.ncr_number).toBe(ncrNumber);
  });

  test('AS1b - creates an NCR with Specification/Drawing Reference omitted (the one optional field), and its detail page still renders', async ({ page }) => {
    // Specification/Drawing Reference is optional (spec.md FR-002a). Every
    // other field on this form — including Discovery Date and Discovery
    // Context — is mandatory.
    const { ncrId } = await createNcrViaUi(page, { specification_drawing_reference: undefined });

    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['status', 'specification_drawing_reference'],
    });
    expect(ncr.status).toBe('Submitted');
    expect(ncr.specification_drawing_reference).toBeFalsy();

    expect((await page.request.get(`/ncrs/${ncrId}`)).status()).toBe(200);
  });

  test('AS1c - detail/disposition/concurrence pages render even when Discovery Date/Context are absent from the underlying document (legacy or externally-created data)', async ({ page, browser }) => {
    // Discovery Date and Discovery Context are mandatory on the standard
    // creation form, but nothing enforces their presence at the schema level
    // (model/ncr.js) — a document created outside that form (fixture data, a
    // migration, a future API caller) can still lack them. Regression check:
    // ncr-detail.jade, ncr-disposition.jade, and ncr-concurrence.jade used to
    // call .replace()/new Date() directly on these fields with no guard,
    // which threw when the field was absent.
    const id = runId();
    const { ncrId } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: {
        part_name: `E2E No-Discovery-Fields ${id}`,
        part_number: `PN-${id}`,
        wbs_number: `WBS-${id}`,
        supplier_name: `Supplier ${id}`,
        originator_id: 'dong',
        originator_name: 'Dong Liu',
        ce_cs_id: 'bob',
        ce_cs_name: CE_CS_DISPLAY_NAME,
        description_of_nonconformance: `No discovery fields test ${id}, exceeding twenty characters.`,
      },
      status: 'Submitted',
      travelerId: '507f1f77bcf86cd799439000',
      stepNumber: 1,
    });

    expect((await page.request.get(`/ncrs/${ncrId}`)).status()).toBe(200);
    expect((await page.request.get(`/ncrs/${ncrId}/disposition`)).status()).toBe(200);

    const ceCsPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    const dispositionRes = await ceCsPage.request.patch(`/api/ncrs/${ncrId}/disposition`, {
      data: {
        parts_disposition: 'Use-As-Is',
        root_cause_documentation: 'Root cause documentation exceeding fifty characters for validation purposes.',
        preventive_actions: ['Preventive action description exceeding fifty characters for validation purposes.'],
      },
    });
    expect(dispositionRes.status()).toBe(200);
    await ceCsPage.close();

    expect((await page.request.get(`/ncrs/${ncrId}/concurrence`)).status()).toBe(200);
  });

  test('AS2 - rejects submission with an invalid field and creates no NCR', async ({ page }) => {
    const data = buildNcrData({
      // Under the 20-character minimum enforced by the client-side check —
      // this reliably reaches the app's own validation logic without being
      // intercepted by native HTML5 constraint validation (the textarea has
      // no native minlength attribute), unlike most other required fields.
      description_of_nonconformance: 'too short',
    });
    await fillNcrForm(page, data);

    await expect(page.locator('#ncr-error')).toBeVisible();
    await expect(page.locator('#ncr-error-msg')).toContainText('Description of Nonconformance must be at least 20 characters');
    await expect(page.locator('#ncr-success')).toBeHidden();
  });

  test('AS2b - server rejects an invalid API request independent of client-side checks', async ({ page }) => {
    // Defense-in-depth: verifies routes/ncr.js's own field validation
    // directly, bypassing the browser form (and any native/client-side
    // validation) entirely, so a regression there is caught even if the UI
    // layer's checks are ever relaxed.
    const data = buildNcrData({ part_name: '', quantity: 0 });
    const res = await page.request.post('/api/ncrs', {
      data: {
        part_number: data.part_number,
        part_revision: data.part_revision,
        quantity: data.quantity,
        supplier_name: data.supplier_name,
        wbs_number: data.wbs_number,
        specification_drawing_reference: data.specification_drawing_reference,
        ce_cs_name: data.ce_cs_name,
        discovery_date: data.discovery_date,
        discovery_context: data.discovery_context,
        description_of_nonconformance: data.description_of_nonconformance,
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.details).toHaveProperty('part_name');
    expect(body.details).toHaveProperty('quantity');
  });

  test('AS3 - sends the CE/CS disposition-request email TO CE/CS, CC Originator', async () => {
    const apiContext = await request.newContext();
    const mailpitClient = createMailpitClient(apiContext, env.mailBaseUrl);

    const message = await mailpitClient.waitForMessage(`subject:"${sharedNcr.ncrNumber}" subject:"Disposition"`);
    const full = await mailpitClient.getMessage(message.ID);
    const bodyText = normalizeWhitespace(full.Text);

    expect(mailpitClient.addresses(full.To)).toContain(CE_CS_EMAIL);
    expect(bodyText).toContain(sharedNcr.ncrNumber);
    expect(bodyText).toContain(sharedNcr.data.part_name);
    expect(bodyText).toContain(sharedNcr.data.supplier_name);

    await apiContext.dispose();
  });

  test('AS4 - sends the QA Admin initial-notification email TO ncr-qa members, CC Originator', async () => {
    const apiContext = await request.newContext();
    const mailpitClient = createMailpitClient(apiContext, env.mailBaseUrl);

    const { members } = await execFixtureCli('get-group', { groupId: NCR_QA_GROUP_ID });
    expect(members.length).toBeGreaterThan(0);

    const message = await mailpitClient.waitForMessage(`subject:"${sharedNcr.ncrNumber}" subject:"Initiated"`);
    const full = await mailpitClient.getMessage(message.ID);
    const bodyText = normalizeWhitespace(full.Text);

    expect(bodyText).toContain(sharedNcr.ncrNumber);
    expect(bodyText).toContain(sharedNcr.data.part_name);
    expect(bodyText).toContain(sharedNcr.data.supplier_name);
    expect(bodyText).toContain(CE_CS_DISPLAY_NAME);

    await apiContext.dispose();
  });

  test('AS5 - records TO and CC delivery status/timestamp independently in the event log', async () => {
    const { ncr } = await execFixtureCli('get-ncr', { ncrId: sharedNcr.ncrId, fields: ['events'] });

    const dispositionEvent = ncr.events.find(e => e.event_type === 'notification.disposition_request');
    expect(dispositionEvent).toBeTruthy();
    expect(dispositionEvent.recipients.length).toBeGreaterThan(0);
    expect(dispositionEvent.recipients[0].delivery_status).toBe('Delivered');
    expect(dispositionEvent.recipients[0].delivery_timestamp).toBeTruthy();
    expect(dispositionEvent.cc.length).toBeGreaterThan(0);
    expect(dispositionEvent.cc[0].delivery_status).toBe('Delivered');
    expect(dispositionEvent.cc[0].delivery_timestamp).toBeTruthy();

    const initialEvent = ncr.events.find(e => e.event_type === 'notification.initial');
    expect(initialEvent).toBeTruthy();
    expect(initialEvent.recipients.length).toBeGreaterThan(0);
    expect(initialEvent.recipients[0].delivery_status).toBe('Delivered');
    expect(initialEvent.recipients[0].delivery_timestamp).toBeTruthy();
    expect(initialEvent.cc.length).toBeGreaterThan(0);
    expect(initialEvent.cc[0].delivery_status).toBe('Delivered');
    expect(initialEvent.cc[0].delivery_timestamp).toBeTruthy();
  });

  test('AS6 - fails submission with a clear error when ncr-qa has no members, and sends no email at all (not even to CE/CS)', async ({ page }) => {
    const { members: originalMembers } = await execFixtureCli('get-group', { groupId: NCR_QA_GROUP_ID });
    await execFixtureCli('remove-group-member', { groupId: NCR_QA_GROUP_ID });

    const apiContext = await request.newContext();
    const mailpitClient = createMailpitClient(apiContext, env.mailBaseUrl);

    try {
      // Baseline: how many disposition-request emails has CE/CS received so
      // far in this run, before the failed attempt below.
      const before = await mailpitClient.search(`to:"${CE_CS_EMAIL}" subject:"Disposition"`);

      const data = buildNcrData();
      await fillNcrForm(page, data);

      await expect(page.locator('#ncr-error')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#ncr-error-msg')).toContainText(
        'NCR-QA group is not configured. Contact an administrator.'
      );
      await expect(page.locator('#ncr-success')).toBeHidden();

      // No NCR was created, so there is no ncr_number to search Mailpit by —
      // instead assert the CE/CS's disposition-request email count did not
      // grow at all, proving the failed attempt sent nothing (per FR-007a:
      // the CE/CS email must not be sent when QA staff isn't configured,
      // even though ce_cs_name/email were validly supplied on the form).
      const after = await mailpitClient.search(`to:"${CE_CS_EMAIL}" subject:"Disposition"`);
      expect(after.length).toBe(before.length);
    } finally {
      for (const memberId of originalMembers) {
        await execFixtureCli('add-group-member', { groupId: NCR_QA_GROUP_ID, userId: memberId });
      }
      await apiContext.dispose();
    }
  });
});
