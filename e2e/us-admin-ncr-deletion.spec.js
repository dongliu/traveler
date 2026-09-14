const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// The primary persona (dong, per e2e/fixtures/env.js / PRIMARY_AUTH_STATE) is
// an admin (see lib/role.js's Admin role), so the default logged-in page
// fixture can drive the dashboard's delete UI directly. bob (SECONDARY_AUTH_STATE)
// is not an admin, used to prove the controls/endpoint are unavailable to them.
const ALLOWED_PDF = { name: 'inspection-report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake pdf bytes') };

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

/** Creates an NCR directly via the fixture CLI (bypassing the UI creation flow, which other spec files already cover). */
async function createTestNcr(overrides = {}) {
  const id = runId();
  const { ncrId, ncr_number: ncrNumber } = await execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Deletion Test Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: 'guobao',
      originator_name: 'Guobao Shen',
      discovery_context: 'incoming_inspection',
      discovery_date: todayIsoDate(),
      description_of_nonconformance: `Deletion test nonconformance description ${id}, exceeding twenty characters.`,
      ...overrides.ncrData,
    },
    status: overrides.status || 'Submitted',
    travelerId: '507f1f77bcf86cd799439000',
    stepNumber: 1,
  });
  return { ncrId, ncrNumber, id };
}

/** Filters the dashboard table down to rows matching one exact supplier name and waits for the table to settle. */
async function filterBySupplier(page, supplierName) {
  await page.goto('/ncrs');
  await page.fill('#f-supplier', supplierName);
  await page.check('#f-includeClosed');
  await page.click('#apply-filters');
  await page.waitForResponse(resp => resp.url().includes('/api/ncrs') && resp.status() === 200);
}

test.describe('Admin NCR Deletion', () => {
  test('AS1 - admin deletes a single NCR with an attachment; the record and its file are both removed', async ({ page }) => {
    const { ncrId, ncrNumber, id } = await createTestNcr({ ncrData: { supplier_name: `AS1 Supplier ${runId()}` } });
    const { ncr: created } = await execFixtureCli('get-ncr', { ncrId, fields: ['supplier_name'] });

    const uploadRes = await page.request.post(`/api/ncrs/${ncrId}/attachments`, {
      multipart: { attachments: ALLOWED_PDF },
    });
    expect(uploadRes.status()).toBe(201);

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['attachments'] });
    expect(ncr.attachments).toHaveLength(1);
    const filePath = ncr.attachments[0].file_path;
    expect((await execFixtureCli('file-exists', { filePath })).exists).toBe(true);

    await filterBySupplier(page, created.supplier_name);
    await expect(page.locator(`.ncr-row-select[data-id="${ncrId}"]`)).toBeVisible();
    await page.check(`.ncr-row-select[data-id="${ncrId}"]`);
    await expect(page.locator('#delete-selected-btn')).toBeEnabled();

    page.once('dialog', dialog => {
      expect(dialog.message()).toContain(ncrNumber);
      dialog.accept();
    });
    await page.click('#delete-selected-btn');

    await expect(page.locator('#delete-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#delete-success')).toContainText('1 of 1 NCR(s) deleted.');
    await expect(page.locator(`.ncr-row-select[data-id="${ncrId}"]`)).toHaveCount(0);

    expect((await page.request.get(`/ncrs/${ncrId}`)).status()).toBe(404);
    expect((await execFixtureCli('file-exists', { filePath })).exists).toBe(false);
    void id;
  });

  test('AS2 - admin deletes multiple selected NCRs in one batch and sees a count summary', async ({ page }) => {
    const supplier = `AS2 Bulk Supplier ${runId()}`;
    const ncr1 = await createTestNcr({ ncrData: { supplier_name: supplier } });
    const ncr2 = await createTestNcr({ ncrData: { supplier_name: supplier } });
    const ncr3 = await createTestNcr({ ncrData: { supplier_name: supplier } });

    await filterBySupplier(page, supplier);
    for (const { ncrId } of [ncr1, ncr2, ncr3]) {
      await page.check(`.ncr-row-select[data-id="${ncrId}"]`);
    }

    page.once('dialog', dialog => dialog.accept());
    await page.click('#delete-selected-btn');

    await expect(page.locator('#delete-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#delete-success')).toContainText('3 of 3 NCR(s) deleted.');

    for (const { ncrId } of [ncr1, ncr2, ncr3]) {
      expect((await page.request.get(`/ncrs/${ncrId}`)).status()).toBe(404);
    }
  });

  test('AS3 - a non-admin sees no delete controls on the dashboard and a direct delete request is rejected', async ({ browser, page }) => {
    const { ncrId } = await createTestNcr();

    const nonAdminPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });
    await nonAdminPage.goto('/ncrs');
    await expect(nonAdminPage.locator('#delete-selected-btn')).toHaveCount(0);
    await expect(nonAdminPage.locator('#select-all-ncrs')).toHaveCount(0);
    await expect(nonAdminPage.locator('.ncr-row-select')).toHaveCount(0);

    const res = await nonAdminPage.request.delete(`/api/ncrs/${ncrId}`);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    await nonAdminPage.close();

    expect((await page.request.get(`/ncrs/${ncrId}`)).status()).toBe(200);
  });

  test('AS4 - a Closed NCR can be deleted the same as any other status', async ({ page }) => {
    const { ncrId } = await createTestNcr({ status: 'Closed' });

    const res = await page.request.delete(`/api/ncrs/${ncrId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect((await page.request.get(`/ncrs/${ncrId}`)).status()).toBe(404);
  });

  test('AS5 - deleting an already-deleted NCR 404s without affecting a sibling deletion', async ({ page }) => {
    const ncr1 = await createTestNcr();
    const ncr2 = await createTestNcr();

    const first = await page.request.delete(`/api/ncrs/${ncr1.ncrId}`);
    expect(first.status()).toBe(200);

    const second = await page.request.delete(`/api/ncrs/${ncr1.ncrId}`);
    expect(second.status()).toBe(404);

    const siblingDeletion = await page.request.delete(`/api/ncrs/${ncr2.ncrId}`);
    expect(siblingDeletion.status()).toBe(200);
  });
});
