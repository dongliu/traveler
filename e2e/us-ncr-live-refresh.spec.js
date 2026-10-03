const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');

// Spec 125 User Story 6 — an open NCR page refreshes its status and details every 30
// seconds, without a page reload, and never over an entry the user is making.
// These tests wait for real 30-second ticks, so each allows for two of them.

const TICK_WAIT = 45000;

test.setTimeout(120000);

async function createNcr(status = 'Submitted') {
  const id = runId();
  const { ncrId } = await execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Refresh Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: 'dong',
      originator_name: 'Dong Liu',
      description_of_nonconformance: `Nonconformance found ${id}, exceeding twenty characters.`,
    },
    status,
  });
  return ncrId;
}

test.describe('US6 — the NCR page refreshes every 30 seconds', () => {
  test('a status change elsewhere shows on the open page, without a reload', async ({ page }) => {
    const ncrId = await createNcr('Submitted');
    await page.goto(`/ncrs/${ncrId}`);
    await page.evaluate(() => {
      globalThis.__noReload = 'still here';
    });
    await expect(page.locator('#ncr-page-body h3 .label')).toHaveText('Submitted');

    await execFixtureCli('set-ncr-status', { ncrId, status: 'Dispositioned' });

    await expect(page.locator('#ncr-page-body h3 .label')).toHaveText('Dispositioned', { timeout: TICK_WAIT });
    expect(await page.evaluate(() => globalThis.__noReload)).toBe('still here');
  });

  test('text typed on the page is kept while the body waits, and the refresh lands once it is cleared', async ({ page }) => {
    const ncrId = await createNcr('Submitted');
    await page.goto(`/ncrs/${ncrId}`);
    await page.locator('#designate-toggle').click();
    await page.fill('#designate-name-input', 'Typed Name');

    await execFixtureCli('set-ncr-status', { ncrId, status: 'Dispositioned' });
    await page.waitForTimeout(TICK_WAIT);

    // an entry is in progress, so the body is held back: the text is still there
    await expect(page.locator('#designate-name-input')).toHaveValue('Typed Name');

    await page.fill('#designate-name-input', '');
    await expect(page.locator('#ncr-page-body h3 .label')).toHaveText('Dispositioned', { timeout: TICK_WAIT });
  });

  test('a closed NCR is still refreshed, so what is added to it later appears', async ({ page }) => {
    const ncrId = await createNcr('Final Approval');
    await page.goto(`/ncrs/${ncrId}`);
    await expect(page.locator('#ncr-page-body h3 .label')).toHaveText('Final Approval');

    await execFixtureCli('set-ncr-status', { ncrId, status: 'Closed' });

    await expect(page.locator('#ncr-page-body h3 .label')).toHaveText('Closed', { timeout: TICK_WAIT });
  });
});
