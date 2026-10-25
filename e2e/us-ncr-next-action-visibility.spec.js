/* global document: false, Node: false -- used inside page.evaluate, where these are the page's own browser globals */
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// Same persona convention as e2e/us3-qa-concurrence-and-approver-coordination.spec.js:
// primary (dong) acts as QA staff and, in this file, as CE/CS/Originator;
// secondary (bob) acts as the designated additional approver, and is also a
// pre-existing ncr-qa member in this dev DB (temporarily removable via the
// same remove-group-member/add-group-member technique that file already uses).
const QA_STAFF_ID = 'dong';
const APPROVER_ID = 'bob';

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Creates an NCR directly in the given status via the fixture CLI (bypassing the UI/API workflow, which other specs already cover). */
async function createNcrInStatus(status, ncrDataOverrides = {}) {
  const id = runId();
  const { ncrId, ncr_number: ncrNumber } = await execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Next-Action Visibility Test Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: 'guobao',
      originator_name: 'Guobao Shen',
      discovery_context: 'incoming_inspection',
      discovery_date: todayIsoDate(),
      description_of_nonconformance: `Next-action visibility test nonconformance ${id}, over twenty chars.`,
      ...ncrDataOverrides,
    },
    status,
    travelerId: '507f1f77bcf86cd799439000',
    inputName: 'field_1',
  });
  return { ncrId, ncrNumber };
}

/** Asserts no action button (any of the four) is present anywhere on the page. */
async function expectNoActionButton(pageHandle) {
  await expect(pageHandle.locator('a:has-text("Create Disposition")')).toHaveCount(0);
  await expect(pageHandle.locator('a:has-text("QA Concurrence")')).toHaveCount(0);
  await expect(pageHandle.locator('a:has-text("Approve / Return")')).toHaveCount(0);
  await expect(pageHandle.locator('a:has-text("Close NCR")')).toHaveCount(0);
}

test.describe('US1 — button repositioned', () => {
  test('the action button is not beside the NCR number, and appears left-aligned above Event Timeline', async ({ page }) => {
    const { ncrId } = await createNcrInStatus('Submitted', { ce_cs_id: QA_STAFF_ID, ce_cs_name: 'Dong Liu' });

    await page.goto(`/ncrs/${ncrId}`);

    // Exactly one "Create Disposition" button on the page, and it lives in
    // the new #ncr-next-action container, not the header row beside the NCR number.
    await expect(page.locator('a:has-text("Create Disposition")')).toHaveCount(1);
    await expect(page.locator('#ncr-next-action a:has-text("Create Disposition")')).toBeVisible();
    await expect(page.locator('h3 a:has-text("Create Disposition")')).toHaveCount(0);

    // #ncr-next-action sits after the header h3 and before Event Timeline.
    const order = await page.evaluate(() => {
      const header = document.querySelector('h3');
      const action = document.querySelector('#ncr-next-action');
      const timeline = document.querySelector('#event-timeline');
      return {
        afterHeader: !!(header.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING),
        beforeTimeline: !!(action.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING),
      };
    });
    expect(order.afterHeader).toBe(true);
    expect(order.beforeTimeline).toBe(true);
  });
});

test.describe('US2 — button permission-gated', () => {
  test('Submitted: only the assigned CE/CS sees Create Disposition', async ({ page, browser }) => {
    const { ncrId } = await createNcrInStatus('Submitted', { ce_cs_id: QA_STAFF_ID, ce_cs_name: 'Dong Liu' });

    await page.goto(`/ncrs/${ncrId}`);
    await expect(page.locator('a:has-text("Create Disposition")')).toBeVisible();

    const bobPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await bobPage.goto(`/ncrs/${ncrId}`);
    await expectNoActionButton(bobPage);
    await bobPage.close();
  });

  test('Dispositioned: only a QA staff member sees QA Concurrence', async ({ page, browser }) => {
    const { ncrId } = await createNcrInStatus('Dispositioned', { ce_cs_id: QA_STAFF_ID, ce_cs_name: 'Dong Liu' });

    await page.goto(`/ncrs/${ncrId}`);
    await expect(page.locator('a:has-text("QA Concurrence")')).toBeVisible();

    // bob is a pre-existing member of the shared ncr-qa group in this dev
    // database (per us3-qa-concurrence-and-approver-coordination.spec.js) --
    // remove them for this assertion, always restoring in `finally`.
    await execFixtureCli('remove-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    try {
      const bobPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
      await bobPage.goto(`/ncrs/${ncrId}`);
      await expectNoActionButton(bobPage);
      await bobPage.close();
    } finally {
      await execFixtureCli('add-group-member', { groupId: 'ncr-qa', userId: APPROVER_ID });
    }
  });

  test('Approval Requested: only a designated approver sees Approve / Return', async ({ page, browser }) => {
    const { ncrId } = await createNcrInStatus('Approval Requested', {
      additional_approvers: [{ approver_id: APPROVER_ID, approval_status: 'Pending' }],
    });

    const bobPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await bobPage.goto(`/ncrs/${ncrId}`);
    await expect(bobPage.locator('a:has-text("Approve / Return")')).toBeVisible();
    await bobPage.close();

    // dong (QA staff) is not a designated approver on this NCR.
    await page.goto(`/ncrs/${ncrId}`);
    await expectNoActionButton(page);
  });

  test('Final Approval: only the Originator or their Designate sees Close NCR', async ({ page, browser }) => {
    const { ncrId } = await createNcrInStatus('Final Approval', { originator_id: QA_STAFF_ID, originator_name: 'Dong Liu' });

    await page.goto(`/ncrs/${ncrId}`);
    await expect(page.locator('a:has-text("Close NCR")')).toBeVisible();

    // bob is neither Originator nor Designate on this NCR.
    const bobPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await bobPage.goto(`/ncrs/${ncrId}`);
    await expectNoActionButton(bobPage);
    await bobPage.close();
  });

  test('a status with no next action (Closed) shows no button, even to a QA staff member', async ({ page }) => {
    const { ncrId } = await createNcrInStatus('Closed');

    await page.goto(`/ncrs/${ncrId}`);
    await expectNoActionButton(page);
  });
});
