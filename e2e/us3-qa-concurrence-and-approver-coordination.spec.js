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
    inputName: 'field_1',
  });
  return { ncrId, ncrNumber };
}

test.describe('US3 - QA Concurrence and Approver Coordination', () => {
  // QA authorization (both server-side isQaStaffMember and the isQa-gated
  // UI sections) is based on ncr-qa group membership, not a role -- dong
  // (the primary persona) is already a member of that shared dev group, so
  // no per-file role grant/revoke is needed here.

  // ── AS1: UI presents username-only approver input ─────────────────────────

  test('AS1 - concurrence page shows Approver column only; no Role column or role input', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await page.goto(`/ncrs/${ncrId}/concurrence`);

    await expect(page.locator('h3')).toContainText('QA Concurrence');

    // Table has exactly one data column header: Approver
    const headers = page.locator('#approvers-table thead th');
    await expect(headers).toHaveCount(2); // Approver + action column
    await expect(headers.nth(0)).toHaveText('Approver');

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

  // ── AS2/AS5: add approver by username only → Approval Requested ──────────

  test('AS2/AS5 - designating an approver by username only moves NCR to Approval Requested with no role stored', async ({ page }) => {
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
    expect(ncr.status).toBe('Approval Requested');
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

    // Row shows the resolved display name, not the raw username
    const row = page.locator('#approvers-list tr').first();
    await expect(row).toContainText(APPROVER_DISPLAY_NAME);
    await expect(row).not.toContainText(APPROVER_ID);

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
    expect(ncr.status).toBe('Approval Requested');
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
    expect(body.ncr.status).toBe('Approval Requested');
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
    await expect(approverPage.locator('#approve-btn')).toBeVisible();
    await expect(approverPage.locator('button:has-text("Return for Comment")')).toBeVisible();

    // Submitting a decision reloads the page to show the NCR's latest state.
    await approverPage.click('#approve-btn');
    await expect(approverPage.locator('.label-info')).toHaveText('Final Approval', { timeout: 10000 });
    await expect(approverPage.locator('#approve-btn')).toHaveCount(0);

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

  // ── AS7: return for comment stops the round; QA starts a new one ────────

  test('AS7 - approver returns for comment, which stops the round and sends the NCR back to Dispositioned', async ({ page, browser }) => {
    const RETURN_COMMENT = 'Rework instructions are unclear about the sanding grit — please clarify with CE/CS.';
    const { ncrId } = await createDispositionedNcr();

    // QA concurs with bob as approver via API -- round 1
    const concRes = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { additional_approvers: [{ approver_id: APPROVER_ID }] },
    });
    expect(concRes.status()).toBe(200);

    // Approver returns for comment
    const approverPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await approverPage.goto(`/ncrs/${ncrId}/approve`);
    await approverPage.fill('#comments', RETURN_COMMENT);
    await approverPage.click('button:has-text("Return for Comment")');
    // Submitting a decision reloads the page to show the NCR's latest state.
    await expect(approverPage.locator('.label-info')).toHaveText('Dispositioned', { timeout: 10000 });
    await approverPage.close();

    let ncr = (await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers'] })).ncr;
    expect(ncr.status).toBe('Dispositioned');
    expect(ncr.additional_approvers[0].approval_status).toBe('Returned for Comment');

    // There is no more "Resubmit to Approvers" action -- the round is over.
    await page.goto(`/ncrs/${ncrId}/approve`);
    await expect(page.locator('button:has-text("Resubmit to Approvers")')).toHaveCount(0);

    // QA starts a new round from Dispositioned -- round 2, same mechanism as the first round.
    const concRes2 = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { additional_approvers: [{ approver_id: APPROVER_ID }] },
    });
    expect(concRes2.status()).toBe(200);

    ncr = (await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers', 'current_approval_round'] })).ncr;
    expect(ncr.status).toBe('Approval Requested');
    expect(ncr.additional_approvers[0].approval_status).toBe('Pending');
    expect(ncr.current_approval_round).toBe(2);
  });

  // ── QA Reject with Comments (spec 130) ────────────────────────────────────

  test('QA rejects a Dispositioned NCR with a required comment, moving it to Rejected status', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    const REJECT_COMMENT = 'Description of nonconformance is missing the affected lot number.';

    await page.goto(`/ncrs/${ncrId}/concurrence`);
    await page.fill('#reject-comments', REJECT_COMMENT);
    await page.click('button:has-text("Reject with Comments")');
    await expect(page.locator('#conc-success')).toBeVisible();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'qa_rejection_comments', 'events'] });
    expect(ncr.status).toBe('Rejected');
    expect(ncr.qa_rejection_comments).toBe(REJECT_COMMENT);
    const rejectedEvent = ncr.events.find(e => e.event_type === 'qa.rejected');
    expect(rejectedEvent).toBeTruthy();
    expect(rejectedEvent.payload.comments).toBe(REJECT_COMMENT);
  });

  test('rejecting with a blank comment is refused', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();

    await page.goto(`/ncrs/${ncrId}/concurrence`);
    await expect(page.locator('button:has-text("Reject with Comments")')).toBeDisabled();

    // Direct API call bypassing the disabled button also refused.
    const res = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { action: 'reject', comments: '' },
    });
    expect(res.status()).toBe(400);
    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status'] });
    expect(ncr.status).toBe('Dispositioned');
  });

  test('API rejects a reject action from a non-QA user', async ({ browser }) => {
    const { ncrId } = await createDispositionedNcr();

    // bob is a pre-existing member of the shared ncr-qa group in this dev
    // database -- remove them for this assertion only, restoring
    // membership afterward (same pattern used elsewhere in this suite).
    await execFixtureCli('remove-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    try {
      const bobPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      const res = await bobPage.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
        data: { action: 'reject', comments: 'Needs more detail' },
      });
      expect(res.status()).toBe(403);
      await bobPage.close();
    } finally {
      await execFixtureCli('add-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    }
  });

  test('API rejects a reject action when the NCR is not Dispositioned', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]); // -> Approval Requested

    const res = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { action: 'reject', comments: 'Needs more detail' },
    });
    expect(res.status()).toBe(409);
  });

  test('Originator resubmits a Rejected NCR, which returns to Submitted and re-notifies CE/CS', async ({ page, browser }) => {
    // bob plays the Originator here (a real, loggable-in identity) rather
    // than the file's usual default originator (guobao, never logged in as).
    const { ncrId } = await createDispositionedNcr({
      ncrData: {
        originator_id: APPROVER_ID, originator_name: APPROVER_DISPLAY_NAME,
        part_revision: 'A', quantity: 1,
      },
    });

    const rejectRes = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { action: 'reject', comments: 'Description needs the affected lot number.' },
    });
    expect(rejectRes.status()).toBe(200);

    const bobPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await bobPage.goto(`/ncrs/${ncrId}/resubmit`);
    await bobPage.fill('#description_of_nonconformance', 'Corrected description including lot number ABC123.');
    await bobPage.click('button:has-text("Resubmit NCR")');
    await expect(bobPage.locator('#ncr-success')).toBeVisible();
    await bobPage.close();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'description_of_nonconformance', 'events'] });
    expect(ncr.status).toBe('Submitted');
    expect(ncr.description_of_nonconformance).toContain('ABC123');
    expect(ncr.events.some(e => e.event_type === 'ncr.resubmitted')).toBe(true);
    expect(ncr.events.some(e => e.event_type === 'notification.disposition_request')).toBe(true);
  });

  test('a user who is neither Originator nor Designate cannot resubmit', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr(); // originator_id: 'guobao' by default
    const rejectRes = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { action: 'reject', comments: 'Needs correction.' },
    });
    expect(rejectRes.status()).toBe(200);

    // dong (QA staff, this file's default page persona) is neither Originator nor Designate on this NCR.
    const res = await page.request.patch(`/api/ncrs/${ncrId}/resubmit`, {
      data: {
        part_name: 'Bracket', part_number: 'BA-1', part_revision: 'A', quantity: 1,
        supplier_name: 'Acme', wbs_number: E2E_WBS,
        description_of_nonconformance: 'Attempted resubmission by a non-Originator.',
        discovery_date: todayIsoDate(), discovery_context: 'incoming_inspection',
      },
    });
    expect(res.status()).toBe(403);
  });

  // ── Manage Approvers: QA can add/remove approvers before issuance ────────

  /** Concurs via the API with the given approver ids (username-only), returning the resulting NCR. */
  async function concurWithApprovers(page, ncrId, approverIds) {
    const res = await page.request.patch(`/api/ncrs/${ncrId}/concurrence`, {
      data: { additional_approvers: approverIds.map(id => ({ approver_id: id })) },
    });
    expect(res.status()).toBe(200);
    return res.json();
  }

  test('QA sees a Manage Approvers section with Remove buttons while the NCR is Approval Requested', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);

    await page.goto(`/ncrs/${ncrId}/approve`);

    await expect(page.locator('fieldset:has(legend:text("Manage Approvers"))')).toBeVisible();
    await expect(page.locator('#new-approver-id')).toBeVisible();
    await expect(page.locator('.remove-approver-btn')).toHaveCount(1);
  });

  test('a designated approver (non-QA) does not see the Manage Approvers section', async ({ browser }) => {
    const { ncrId } = await createDispositionedNcr();

    // Uses the project's default (primary/QA) storage state to concur.
    const setupPage = await browser.newPage();
    await concurWithApprovers(setupPage, ncrId, [APPROVER_ID]);
    await setupPage.close();

    // bob is a pre-existing member of the shared ncr-qa group in this dev
    // database -- remove them for this assertion only, restoring
    // membership afterward (same pattern used elsewhere in this suite).
    await execFixtureCli('remove-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    try {
      const approverPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      await approverPage.goto(`/ncrs/${ncrId}/approve`);

      await expect(approverPage.locator('fieldset:has(legend:text("Manage Approvers"))')).toHaveCount(0);
      await expect(approverPage.locator('.remove-approver-btn')).toHaveCount(0);
      await approverPage.close();
    } finally {
      await execFixtureCli('add-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    }
  });

  test('QA adds an approver from the approval page and it appears Pending without moving the NCR out of Approval Requested', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);

    await page.goto(`/ncrs/${ncrId}/approve`);
    await page.fill('#new-approver-id', 'guobao');
    await page.click('#add-approver-btn');

    await page.waitForURL(new RegExp(`/ncrs/${ncrId}/approve$`));
    await expect(page.locator('table:has(th:text("Approver")) tbody tr')).toHaveCount(2);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers', 'events'] });
    expect(ncr.status).toBe('Approval Requested');
    expect(ncr.additional_approvers).toHaveLength(2);
    const added = ncr.additional_approvers.find(a => a.approver_id === 'guobao');
    expect(added).toBeTruthy();
    expect(added.approval_status).toBe('Pending');
    expect(ncr.events.some(e => e.event_type === 'approver.added')).toBe(true);
  });

  test('QA removes a non-blocking approver and the NCR stays Approval Requested', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID, 'guobao']);

    await page.goto(`/ncrs/${ncrId}/approve`);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.remove-approver-btn').first().click();

    await page.waitForURL(new RegExp(`/ncrs/${ncrId}/approve$`));

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers', 'events'] });
    expect(ncr.status).toBe('Approval Requested');
    expect(ncr.additional_approvers).toHaveLength(1);
    expect(ncr.events.some(e => e.event_type === 'approver.removed')).toBe(true);
  });

  test('QA removing the last Pending approver advances the NCR to Final Approval', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);

    await page.goto(`/ncrs/${ncrId}/approve`);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.remove-approver-btn').first().click();

    await page.waitForURL(new RegExp(`/ncrs/${ncrId}/approve$`));
    // Manage Approvers section is gone now that the NCR is no longer Approval Requested
    await expect(page.locator('fieldset:has(legend:text("Manage Approvers"))')).toHaveCount(0);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers', 'events'] });
    expect(ncr.status).toBe('Final Approval');
    expect(ncr.additional_approvers).toHaveLength(0);
    expect(ncr.events.some(e => e.event_type === 'notification.issuance')).toBe(true);
  });

  test('QA cannot manage approvers or unblock anything once a round is stopped -- QA must start a new round from Dispositioned', async ({ page, browser }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID, 'guobao']);

    // bob returns for comment, stopping the round outright
    const approverPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    const returnRes = await approverPage.request.patch(`/api/ncrs/${ncrId}/approve`, {
      data: { action: 'return_for_comment', comments: 'Please clarify the rework instructions.' },
    });
    expect(returnRes.status()).toBe(200);
    await approverPage.close();

    const ncr = (await execFixtureCli('get-ncr', { ncrId, fields: ['status'] })).ncr;
    expect(ncr.status).toBe('Dispositioned');

    // Manage Approvers is gone -- the round is over, there is nothing to manage.
    await page.goto(`/ncrs/${ncrId}/approve`);
    await expect(page.locator('fieldset:has(legend:text("Manage Approvers"))')).toHaveCount(0);

    // No approver can be added or removed once the round is no longer open.
    const removeRes = await page.request.delete(`/api/ncrs/${ncrId}/approvers/guobao`);
    expect(removeRes.status()).toBe(409);
  });

  // ── Round history: events are tagged with the round they belong to ──────

  test('approval-round events are tagged with their round number across a stopped round and a new one', async ({ page, browser }) => {
    const { ncrId } = await createDispositionedNcr();

    // Round 1: bob returns for comment, stopping it.
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);
    const approverPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    const returnRes = await approverPage.request.patch(`/api/ncrs/${ncrId}/approve`, {
      data: { action: 'return_for_comment', comments: 'Needs another look.' },
    });
    expect(returnRes.status()).toBe(200);

    // Round 2: bob is designated again and approves -- the only approver, so it completes.
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);
    const approveRes = await approverPage.request.patch(`/api/ncrs/${ncrId}/approve`, {
      data: { action: 'approve' },
    });
    expect(approveRes.status()).toBe(200);
    await approverPage.close();

    const eventsRes = await page.request.get(`/api/ncrs/${ncrId}/events`);
    expect(eventsRes.status()).toBe(200);
    const { events } = await eventsRes.json();
    const returnedEvent = events.find(e => e.event_type === 'approval.returned_for_comment');
    expect(returnedEvent.round).toBe(1);
    const secondConcurEvent = events.filter(e => e.event_type === 'qa.concurred')[1];
    expect(secondConcurEvent.round).toBe(2);
    const approvedEvent = events.find(e => e.event_type === 'approval.approved');
    expect(approvedEvent.round).toBe(2);

    await page.goto(`/ncrs/${ncrId}`);
    await page.click('#timeline-toggle');
    const timelineText = await page.locator('#event-timeline').innerText();
    expect(timelineText).toContain('Round 1');
    expect(timelineText).toContain('Round 2');
  });

  test('API: add-approver is rejected for a non-QA user, a non-Approval-Requested NCR, and a duplicate approver', async ({ page, browser }) => {
    const { ncrId: dispositionedNcrId } = await createDispositionedNcr();
    const wrongStatusRes = await page.request.post(`/api/ncrs/${dispositionedNcrId}/approvers`, {
      data: { approver_id: APPROVER_ID },
    });
    expect(wrongStatusRes.status()).toBe(409);

    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);

    // bob (the secondary persona) is a pre-existing member of the shared
    // ncr-qa group in this dev database — remove them for this assertion
    // only, restoring membership afterward (same pattern used elsewhere in
    // this suite for temporarily emptying/altering the ncr-qa group).
    await execFixtureCli('remove-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    try {
      const nonQaPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      const forbiddenRes = await nonQaPage.request.post(`/api/ncrs/${ncrId}/approvers`, {
        data: { approver_id: 'guobao' },
      });
      expect(forbiddenRes.status()).toBe(403);
      await nonQaPage.close();
    } finally {
      await execFixtureCli('add-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    }

    const duplicateRes = await page.request.post(`/api/ncrs/${ncrId}/approvers`, {
      data: { approver_id: APPROVER_ID },
    });
    expect(duplicateRes.status()).toBe(409);
  });

  test('API: remove-approver is rejected for a non-existent approver and a non-Approval-Requested NCR', async ({ page }) => {
    const { ncrId: dispositionedNcrId } = await createDispositionedNcr();
    const wrongStatusRes = await page.request.delete(`/api/ncrs/${dispositionedNcrId}/approvers/${APPROVER_ID}`);
    expect(wrongStatusRes.status()).toBe(409);

    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);

    const notFoundRes = await page.request.delete(`/api/ncrs/${ncrId}/approvers/no-such-user`);
    expect(notFoundRes.status()).toBe(404);
  });

  // ── Manage Approvers is also available on the NCR detail page ───────────

  test('QA sees Manage Approvers on the NCR detail page (not just /approve) while Approval Requested', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);

    await page.goto(`/ncrs/${ncrId}`);

    await expect(page.locator('fieldset:has(legend:text("Manage Approvers"))')).toBeVisible();
    await expect(page.locator('#new-approver-id')).toBeVisible();
    await expect(page.locator('.remove-approver-btn')).toHaveCount(1);
  });

  test('QA adds an approver from the NCR detail page', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID]);

    await page.goto(`/ncrs/${ncrId}`);
    await page.fill('#new-approver-id', 'guobao');
    await page.click('#add-approver-btn');

    await page.waitForURL(new RegExp(`/ncrs/${ncrId}$`));
    await expect(page.locator('#approver-status-list tr')).toHaveCount(2);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers'] });
    expect(ncr.status).toBe('Approval Requested');
    expect(ncr.additional_approvers).toHaveLength(2);
  });

  test('QA removes a non-blocking approver from the NCR detail page and the NCR stays Approval Requested', async ({ page }) => {
    const { ncrId } = await createDispositionedNcr();
    await concurWithApprovers(page, ncrId, [APPROVER_ID, 'guobao']);

    await page.goto(`/ncrs/${ncrId}`);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.remove-approver-btn').first().click();

    await page.waitForURL(new RegExp(`/ncrs/${ncrId}$`));

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['status', 'additional_approvers'] });
    expect(ncr.status).toBe('Approval Requested');
    expect(ncr.additional_approvers).toHaveLength(1);
  });

  test('a designated approver (non-QA) does not see Manage Approvers on the NCR detail page', async ({ browser }) => {
    const { ncrId } = await createDispositionedNcr();
    const setupPage = await browser.newPage();
    await concurWithApprovers(setupPage, ncrId, [APPROVER_ID]);
    await setupPage.close();

    // bob is a pre-existing member of the shared ncr-qa group in this dev
    // database -- remove them for this assertion only, restoring
    // membership afterward (same pattern used elsewhere in this suite).
    await execFixtureCli('remove-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    try {
      const approverPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      await approverPage.goto(`/ncrs/${ncrId}`);

      await expect(approverPage.locator('fieldset:has(legend:text("Manage Approvers"))')).toHaveCount(0);
      await expect(approverPage.locator('.remove-approver-btn')).toHaveCount(0);
      await approverPage.close();
    } finally {
      await execFixtureCli('add-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    }
  });
});
