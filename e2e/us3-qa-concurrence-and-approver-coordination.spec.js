const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// Primary persona (dong) acts as QA staff throughout this file.
// Secondary persona (bob) acts as the designated additional approver.
const QA_STAFF_ID = 'dong';
const APPROVER_ID = 'bob';
const APPROVER_DISPLAY_NAME = 'Bob Dalesio';

// Predefined WBS entry from docker/wbs.yaml — ensures the WBS notification
// registry resolves a contact so all email notification paths trigger correctly.
const E2E_WBS = '1.2.3';

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Creates an NCR already in Dispositioned status with a Rework disposition. */
async function createDispositionedNcr(overrides = {}) {
  const id = runId();
  const { ncrId, ncr_number: ncrNumber } = await execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Concurrence Test Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: E2E_WBS,
      supplier_name: `Supplier ${id}`,
      originator_id: 'guobao',
      originator_name: 'Guobao Shen',
      ce_cs_id: QA_STAFF_ID,
      ce_cs_name: 'Dong Liu',
      discovery_context: 'incoming_inspection',
      discovery_date: todayIsoDate(),
      description_of_nonconformance: `Concurrence test nonconformance ${id}, exceeding twenty chars.`,
      disposition: {
        parts_disposition: 'Rework',
        rework_repair_instructions: 'Sand and re-inspect per DWG-100.',
        ce_cs_identity: QA_STAFF_ID,
        ce_cs_timestamp: new Date().toISOString(),
      },
      ...overrides.ncrData,
    },
    status: 'Dispositioned',
    travelerId: '507f1f77bcf86cd799439000',
    stepNumber: 1,
  });
  return { ncrId, ncrNumber };
}

test.describe('US3 - QA Concurrence and Approver Coordination', () => {
  test.beforeAll(async () => {
    await execFixtureCli('grant-role', { userId: QA_STAFF_ID, role: 'qa_staff' });
  });

  test.afterAll(async () => {
    await execFixtureCli('remove-role', { userId: QA_STAFF_ID, role: 'qa_staff' });
  });

  // ── AS1: UI presents username-only approver input ─────────────────────────

  test('AS1 - concurrence page shows Username column only; no Role column or role input', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    await expect(page.locator('h3')).toContainText('QA Concurrence');

    // Table has exactly one data column header: Username
    const headers = page.locator('#approvers-table thead th');
    await expect(headers).toHaveCount(2); // Username + action column
    await expect(headers.nth(0)).toHaveText('Username');

    // No role input exists anywhere
    await expect(page.locator('#new-approver-role')).toHaveCount(0);

    // Username input exists
    await expect(page.locator('#new-approver-id')).toBeVisible();
  });

  test('AS1b - empty approver list shows the zero-approvers placeholder spanning both columns', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    await expect(page.locator('#approvers-list td[colspan="2"]')).toBeVisible();
    await expect(page.locator('#approvers-list')).toContainText(
      'No additional approvers — concurring will move NCR directly to Final Approval.'
    );
  });

  // ── AS2/AS3: zero approvers → Final Approval ──────────────────────────────

  test('AS3 - concurring with zero approvers moves NCR directly to Final Approval', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    await page.click('#concur-btn');

    await expect(page.locator('#conc-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#conc-success-msg')).toContainText('NCR moved to Final Approval');

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'qa_staff_identity', 'events'] });
    expect(ncr.status).toBe('Final Approval');
    expect(ncr.qa_staff_identity).toBe(QA_STAFF_ID);
    expect(ncr.events.some(e => e.event_type === 'qa.concurred')).toBe(true);
    expect(ncr.events.some(e => e.event_type === 'notification.issuance')).toBe(true);
  });

  // ── AS2/AS5: add approver by username only → Approved ────────────────────

  test('AS2/AS5 - designating an approver by username only moves NCR to Approved with no role stored', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    await page.fill('#new-approver-id', APPROVER_ID);
    await page.click('#add-approver');

    // Row appears with username only — no role value in any cell
    const row = page.locator('#approvers-list tr').first();
    await expect(row).toContainText(APPROVER_ID);
    const cells = row.locator('td');
    await expect(cells).toHaveCount(2); // username cell + remove cell

    await page.click('#concur-btn');
    await expect(page.locator('#conc-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#conc-success-msg')).toContainText('Approval requests sent to 1 approver(s)');

    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['status', 'additional_approvers', 'events'],
    });
    expect(ncr.status).toBe('Approved');
    expect(ncr.additional_approvers).toHaveLength(1);
    expect(ncr.additional_approvers[0].approver_id).toBe(APPROVER_ID);
    expect(ncr.additional_approvers[0].approval_status).toBe('Pending');
    expect(ncr.additional_approvers[0].approver_role).toBeUndefined();
    expect(ncr.events.some(e => e.event_type === 'approvers.designated')).toBe(true);
    expect(ncr.events.some(e => e.event_type === 'notification.approval_request')).toBe(true);
  });

  test('AS2 - typing the approver\'s full display name resolves via typeahead to their username', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    await page.fill('#new-approver-id', APPROVER_DISPLAY_NAME);
    await page.waitForSelector('.tt-suggestion', { timeout: 5000 }).catch(() => {});
    await page.click('#add-approver');

    // Row shows the resolved username (bob), not the typed display name
    const row = page.locator('#approvers-list tr').first();
    await expect(row).toContainText(APPROVER_ID);
    await expect(row).not.toContainText(APPROVER_DISPLAY_NAME);

    await page.click('#concur-btn');
    await expect(page.locator('#conc-success')).toBeVisible({ timeout: 10000 });

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['additional_approvers'] });
    expect(ncr.additional_approvers[0].approver_id).toBe(APPROVER_ID);
  });

  // ── US2: duplicate username silently ignored ──────────────────────────────

  test('US2 - adding the same username twice leaves only one entry in the list', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    await page.fill('#new-approver-id', APPROVER_ID);
    await page.click('#add-approver');
    await page.fill('#new-approver-id', APPROVER_ID);
    await page.click('#add-approver');

    // Exactly one data row (not counting the tfoot add-row)
    const rows = page.locator('#approvers-list tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(APPROVER_ID);
  });

  // ── US3: remove approver before submit ───────────────────────────────────

  test('US3 - removing an approver before concur means they receive no approval request', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    // Add two approvers
    await page.fill('#new-approver-id', APPROVER_ID);
    await page.click('#add-approver');
    await page.fill('#new-approver-id', 'guobao');
    await page.click('#add-approver');

    await expect(page.locator('#approvers-list tr')).toHaveCount(2);

    // Remove the first one (bob)
    await page.locator('#approvers-list tr').first().getByText('Remove').click();
    await expect(page.locator('#approvers-list tr')).toHaveCount(1);
    await expect(page.locator('#approvers-list')).toContainText('guobao');
    await expect(page.locator('#approvers-list')).not.toContainText(APPROVER_ID);

    await page.click('#concur-btn');
    await expect(page.locator('#conc-success')).toBeVisible({ timeout: 10000 });

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers'] });
    expect(ncr.status).toBe('Approved');
    expect(ncr.additional_approvers).toHaveLength(1);
    expect(ncr.additional_approvers[0].approver_id).toBe('guobao');
    expect(ncr.additional_approvers.some(a => a.approver_id === APPROVER_ID)).toBe(false);
  });

  // ── API defence ───────────────────────────────────────────────────────────

  test('API rejects a concurrence payload with an entry missing approver_id', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    const res = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { additional_approvers: [{}] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.details.additional_approvers[0]).toMatch(/approver_id/);
  });

  test('API accepts a concurrence payload with approver_id only (no role field)', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    const res = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { additional_approvers: [{ approver_id: APPROVER_ID }] },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ncr.status).toBe('Approved');
    expect(body.ncr.additional_approvers[0].approver_id).toBe(APPROVER_ID);
  });

  // ── AS6/AS8: designated approver approves → Final Approval ───────────────

  test('AS6/AS8 - designated approver sees the approval page and approving moves NCR to Final Approval', async ({ page, browser }) => {
    const { ncrId } = await createDispositionedNcr();

    // QA concurs with bob as approver via API
    const concRes = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { additional_approvers: [{ approver_id: APPROVER_ID }] },
    });
    expect(concRes.status()).toBe(200);

    // Log in as the approver (secondary user = bob)
    const approverPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await approverPage.goto(`/ncrs/${ncrId}/approve`);

    await expect(approverPage.locator('h3')).toContainText('NCR Approval');
    await expect(approverPage.locator('button:has-text("Approve")')).toBeVisible();
    await expect(approverPage.locator('button:has-text("Return for Comment")')).toBeVisible();

    await approverPage.click('button:has-text("Approve")');
    await expect(approverPage.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(approverPage.locator('.alert-success')).toContainText('All approvers have approved');

    await approverPage.close();

    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['status', 'additional_approvers', 'events'],
    });
    expect(ncr.status).toBe('Final Approval');
    expect(ncr.additional_approvers[0].approval_status).toBe('Approved');
    expect(ncr.events.some(e => e.event_type === 'approval.approved')).toBe(true);
    expect(ncr.events.some(e => e.event_type === 'notification.issuance')).toBe(true);
  });

  // ── AS7: return for comment, QA resubmits ────────────────────────────────

  test('AS7 - approver returns for comment, QA staff resubmits to approvers', async ({ page, browser }) => {
    const RETURN_COMMENT = 'Rework instructions are unclear about the sanding grit — please clarify with CE/CS.';
    const { ncrId } = await createDispositionedNcr();

    // QA concurs with bob as approver via API
    const concRes = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { additional_approvers: [{ approver_id: APPROVER_ID }] },
    });
    expect(concRes.status()).toBe(200);

    // Approver returns for comment
    const approverPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await approverPage.goto(`/ncrs/${ncrId}/approve`);
    await approverPage.fill('#comments', RETURN_COMMENT);
    await approverPage.click('button:has-text("Return for Comment")');
    await expect(approverPage.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(approverPage.locator('.alert-success')).toContainText('Returned for comment');
    await approverPage.close();

    let ncr = (await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers'] })).ncr;
    expect(ncr.status).toBe('Returned for Comment');
    expect(ncr.additional_approvers[0].approval_status).toBe('Returned for Comment');

    // QA staff resubmits
    await page.goto(`/ncrs/${ncrId}/approve`);
    await expect(page.locator('button:has-text("Resubmit to Approvers")')).toBeVisible();
    await page.click('button:has-text("Resubmit to Approvers")');
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.alert-success')).toContainText('Resubmitted');

    ncr = (await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers', 'events'] })).ncr;
    expect(ncr.status).toBe('Approved');
    expect(ncr.additional_approvers[0].approval_status).toBe('Pending');
    expect(ncr.events.some(e => e.event_type === 'qa.resubmitted')).toBe(true);
  });

  // ── AS9: no rejection path (spec/implementation gap) ─────────────────────

  test('AS9 - concurrence endpoint ignores unrecognised action field and does not perform rejection', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    const res = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { action: 'reject', comments: 'Needs more detail', additional_approvers: [] },
    });
    // Endpoint either succeeds (ignoring the unrecognised action) or returns
    // an error — in either case, the NCR must NOT have a qa.rejected event.
    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'events'] });
    expect(ncr.events.some(e => e.event_type === 'qa.rejected')).toBe(false);
    // If the request succeeded, NCR should have moved to Final Approval (no approvers),
    // not to a rejected state.
    if (res.status() === 200) {
      expect(ncr.status).toBe('Final Approval');
    }
  });
});
