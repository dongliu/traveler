const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// Mirrors the allowed-mimetype set applied server-side (lib/upload.js, shared
// with routes/traveler.js) — images/text always pass, plus this fixed list.
const ALLOWED_IMAGE = { name: 'inspection-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake jpeg bytes') };
const ALLOWED_PDF = { name: 'inspection-report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake pdf bytes') };
const DISALLOWED_FILE = { name: 'archive.zip', mimeType: 'application/zip', buffer: Buffer.from('fake zip bytes') };

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function buildNcrData(overrides = {}) {
  const id = runId();
  return {
    id,
    part_name: `E2E Attachment Bracket ${id}`,
    part_number: `PN-${id}`,
    part_revision: 'A',
    quantity: '2',
    supplier_name: `E2E Supplier ${id}`,
    wbs_number: `WBS-${id}`,
    ce_cs_name: 'Bob Dalesio',
    discovery_date: todayIsoDate(),
    discovery_context: 'incoming_inspection',
    description_of_nonconformance: `E2E attachment test nonconformance description for run ${id}.`,
    ...overrides,
  };
}

/** Fills the NCR creation form (without submitting) so a test can attach files before clicking submit. */
async function fillNcrForm(page, data) {
  await page.goto('/ncrs/new');
  await page.fill('#part_name', data.part_name);
  await page.fill('#part_number', data.part_number);
  await page.fill('#part_revision', data.part_revision);
  await page.fill('#quantity', String(data.quantity));
  await page.fill('#supplier_name', data.supplier_name);
  await page.fill('#wbs_number', data.wbs_number);

  await page.fill('#ce_cs_name', data.ce_cs_name);
  await page.waitForSelector('.tt-suggestion', { timeout: 5000 }).catch(() => {});

  await page.fill('#discovery_date', data.discovery_date);
  await page.check(`input[name="discovery_context"][value="${data.discovery_context}"]`);
  await page.fill('#description_of_nonconformance', data.description_of_nonconformance);
}

test.describe('NCR Attachments', () => {
  test('uploads allowed file types selected on the creation form and lists them on the NCR detail page', async ({ page }) => {
    const data = buildNcrData();
    await fillNcrForm(page, data);
    await page.setInputFiles('#attachments', [ALLOWED_IMAGE, ALLOWED_PDF]);
    await page.click('#submit-btn');

    await expect(page.locator('#ncr-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#attachment-status')).toContainText('2 attachment(s) uploaded.', { timeout: 10000 });

    const href = await page.locator('#ncr-number-link').getAttribute('href');
    const ncrId = href.split('/').pop();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['attachments'] });
    expect(ncr.attachments).toHaveLength(2);
    const names = ncr.attachments.map(a => a.file_name).sort();
    expect(names).toEqual([ALLOWED_IMAGE.name, ALLOWED_PDF.name].sort());
    expect(ncr.attachments[0].uploaded_by).toBeTruthy();
    expect(ncr.attachments[0].upload_timestamp).toBeTruthy();

    await page.goto(`/ncrs/${ncrId}`);
    await expect(page.locator(`a:has-text("${ALLOWED_IMAGE.name}")`)).toBeVisible();
    await expect(page.locator(`a:has-text("${ALLOWED_PDF.name}")`)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.click(`a:has-text("${ALLOWED_PDF.name}")`);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(ALLOWED_PDF.name);
  });

  test('silently drops a disallowed file type while still uploading the allowed ones alongside it', async ({ page }) => {
    const data = buildNcrData();
    await fillNcrForm(page, data);
    await page.setInputFiles('#attachments', [ALLOWED_IMAGE, DISALLOWED_FILE]);
    await page.click('#submit-btn');

    await expect(page.locator('#ncr-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#attachment-status')).toContainText(
      '1 of 2 attachment(s) uploaded (some file types are not allowed).',
      { timeout: 10000 }
    );

    const href = await page.locator('#ncr-number-link').getAttribute('href');
    const ncrId = href.split('/').pop();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['attachments'] });
    expect(ncr.attachments).toHaveLength(1);
    expect(ncr.attachments[0].file_name).toBe(ALLOWED_IMAGE.name);
  });

  test('creating an NCR with no files selected leaves attachments empty (no regression)', async ({ page }) => {
    const data = buildNcrData();
    await fillNcrForm(page, data);
    await page.click('#submit-btn');

    await expect(page.locator('#ncr-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#attachment-status')).toBeEmpty();

    const href = await page.locator('#ncr-number-link').getAttribute('href');
    const ncrId = href.split('/').pop();

    const { ncr } = await execFixtureCli('get-ncr', { ncrId, fields: ['attachments'] });
    expect(ncr.attachments).toHaveLength(0);
  });

  test('a user without access to the NCR cannot upload or download attachments', async ({ page, browser }) => {
    const id = runId();
    const { ncrId } = await execFixtureCli('create-traveler-linked-ncr', {
      ncrData: {
        part_name: `E2E Attachment ACL Test ${id}`,
        part_number: `PN-${id}`,
        wbs_number: `WBS-${id}`,
        supplier_name: `Supplier ${id}`,
        originator_id: 'guobao',
        originator_name: 'Guobao Shen',
        description_of_nonconformance: `Attachment ACL test ${id}.`,
      },
      status: 'Submitted',
      travelerId: '507f1f77bcf86cd799439000',
      stepNumber: 1,
    });

    const otherPage = await browser.newPage({ storageState: SECONDARY_AUTH_STATE });

    const uploadRes = await otherPage.request.post(`/api/ncrs/${ncrId}/attachments`, {
      multipart: { attachments: { name: ALLOWED_IMAGE.name, mimeType: ALLOWED_IMAGE.mimeType, buffer: ALLOWED_IMAGE.buffer } },
    });
    expect(uploadRes.status()).toBe(403);

    const downloadRes = await otherPage.request.get(`/api/ncrs/${ncrId}/attachments/000000000000000000000000`);
    expect(downloadRes.status()).toBe(403);

    await otherPage.close();
  });
});
