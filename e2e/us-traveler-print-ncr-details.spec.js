/* global document: false, Node: false -- used inside page.evaluate, where these are the page's own browser globals */
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');

// Spec 126 — extend the traveler print page with every linked NCR's detail
// (minus Event History), gathered at the end, in the traveler's own
// top-to-bottom form order, plus the traveler's own review/approval history,
// automatically. Both are fetched client-side by public/javascripts/traveler-print.js;
// GET /travelers/:id/print itself is unchanged, so this is covered as a
// browser-rendered-content concern, not a server-side-render one.

const PRIMARY = 'dong';

/**
 * Creates a real, writable, completed traveler with two text inputs through
 * the fixture CLI. Completed (status 2) because the print page's own
 * #create-pdf control — this feature's gating target — only renders for a
 * completed traveler (views/traveler-print.jade).
 */
async function createTwoInputTraveler(id) {
  const { travelerId } = await execFixtureCli('create-fillable-traveler', {
    createdBy: PRIMARY,
    title: `E2E Print NCR Traveler ${id}`,
    status: 2,
    inputs: [
      { name: 'input_a', label: `Input A ${id}` },
      { name: 'input_b', label: `Input B ${id}` },
    ],
  });
  return travelerId;
}

/** An NCR linked to one input of a traveler, created directly through the fixture CLI. */
function createLinkedNcr(id, { travelerId, inputName, inputLabel, status = 'Closed', description }) {
  return execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Print Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: PRIMARY,
      originator_name: 'Dong Liu',
      description_of_nonconformance: description || `Print test ${id}, exceeding twenty characters.`,
    },
    status,
    travelerId,
    inputName,
    inputLabel,
  });
}

test.describe('US1 — every linked NCR, gathered at the end, in form order', () => {
  test('NCRs print in form order (not creation order), with no Event History, after the form', async ({ page }) => {
    const id = runId();
    const travelerId = await createTwoInputTraveler(id);

    // Create the NCR linked to the SECOND input first, so creation order and
    // form order disagree.
    const { ncr_number: ncrOnB } = await createLinkedNcr(id, {
      travelerId,
      inputName: 'input_b',
      inputLabel: `Input B ${id}`,
    });
    const { ncr_number: ncrOnA } = await createLinkedNcr(id, {
      travelerId,
      inputName: 'input_a',
      inputLabel: `Input A ${id}`,
    });

    const [detailsResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/ncr-print-details/')),
      page.goto(`/travelers/${travelerId}/print`),
    ]);

    // (a) the endpoint itself returns the first-input's NCR before the
    // second-input's, regardless of creation order.
    const details = await detailsResponse.json();
    expect(details.map(d => d.ncrTitle)).toEqual([ncrOnA, ncrOnB]);

    // (b) no Event History heading anywhere on the page.
    await expect(page.locator('#ncr-print-sections')).not.toContainText('Event History');

    // (c) #ncr-print-sections is rendered after #form, not before or inside it.
    const ncrSectionIsAfterForm = await page.evaluate(() => {
      const form = document.querySelector('#form');
      const ncrSection = document.querySelector('#ncr-print-sections');
      return !!(form.compareDocumentPosition(ncrSection) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(ncrSectionIsAfterForm).toBe(true);

    // (d) #create-pdf starts disabled and becomes enabled once this page's
    // fetches have resolved.
    await expect(page.locator('#create-pdf')).toBeEnabled();
  });

  test('a traveler with no linked NCRs shows a "no NCRs" line instead of an empty section', async ({ page }) => {
    const id = runId();
    const travelerId = await createTwoInputTraveler(id);

    await page.goto(`/travelers/${travelerId}/print`);

    await expect(page.locator('#ncr-print-sections')).toContainText('No NCRs linked to this traveler.');
  });

  test('markup-like text in an NCR renders literally, never as markup', async ({ page }) => {
    const id = runId();
    const travelerId = await createTwoInputTraveler(id);
    const dangerousText = `<b>bold</b> & "quoted" ${id}`;
    await createLinkedNcr(id, {
      travelerId,
      inputName: 'input_a',
      inputLabel: `Input A ${id}`,
      description: dangerousText,
    });

    await page.goto(`/travelers/${travelerId}/print`);

    const section = page.locator('#ncr-print-sections');
    await expect(section).toContainText(dangerousText);
    // the literal string rendered as text, not interpreted as an element
    expect(await section.locator('b').count()).toBe(0);
  });

  test('#create-pdf starts disabled before the page content loads', async ({ page }) => {
    const id = runId();
    const travelerId = await createTwoInputTraveler(id);

    let releaseDetails;
    await page.route('**/ncr-print-details/', async route => {
      await new Promise(resolve => {
        releaseDetails = resolve;
      });
      await route.continue();
    });

    await page.goto(`/travelers/${travelerId}/print`);
    await expect(page.locator('#create-pdf')).toBeDisabled();

    releaseDetails();
    await expect(page.locator('#create-pdf')).toBeEnabled();
  });
});

test.describe('US2 — review records, automatically', () => {
  test('every recorded review result is shown automatically, including a voided one, with no toggle', async ({ page }) => {
    const id = runId();
    const travelerId = await createTwoInputTraveler(id);
    await execFixtureCli('set-traveler-review-results', {
      travelerId,
      reviewResults: [
        { reviewerId: PRIMARY, result: '1', v: 1, submittedOn: new Date().toISOString(), comment: `Approved ${id}` },
        { reviewerId: 'bob', result: '2', v: 1, submittedOn: new Date().toISOString(), comment: `Rejected ${id}`, voided: true },
      ],
    });

    const [reviewResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/review-records/')),
      page.goto(`/travelers/${travelerId}/print`),
    ]);

    const section = await reviewResponse.json();
    expect(section.heading).toBe('Approvals');
    expect(section.table.rows.some(row => row[1] === 'Rejected (voided)')).toBe(true);

    // rendered automatically, with the traveler's own content — no button needed
    await expect(page.locator('#review-records')).toContainText('Approved');
    await expect(page.locator('#review-records')).toContainText('Rejected (voided)');
  });

  test('a traveler with no review history shows "None recorded"', async ({ page }) => {
    const id = runId();
    const travelerId = await createTwoInputTraveler(id);

    const [reviewResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/review-records/')),
      page.goto(`/travelers/${travelerId}/print`),
    ]);

    const section = await reviewResponse.json();
    expect(section).toEqual({ heading: 'Approvals', note: 'None recorded' });
    await expect(page.locator('#review-records')).toContainText('None recorded');
  });

  test('#create-pdf stays disabled while only the NCR fetch has resolved, and enables once the review-records fetch resolves too', async ({ page }) => {
    const id = runId();
    const travelerId = await createTwoInputTraveler(id);

    let releaseReviewRecords;
    await page.route('**/review-records/', async route => {
      await new Promise(resolve => {
        releaseReviewRecords = resolve;
      });
      await route.continue();
    });

    const [detailsResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/ncr-print-details/')),
      page.goto(`/travelers/${travelerId}/print`),
    ]);
    await detailsResponse.json();

    // the NCR fetch has resolved, but review-records is still held back
    await expect(page.locator('#create-pdf')).toBeDisabled();

    releaseReviewRecords();
    await expect(page.locator('#create-pdf')).toBeEnabled();
  });
});
