const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');

// Spec 131 — admin traveler unarchive.
//
// The primary persona (dong, per e2e/fixtures/env.js / PRIMARY_AUTH_STATE) is
// an admin (see lib/role.js's Admin role), so the default logged-in page
// fixture can drive PUT /travelers/:id/unarchive directly. bob
// (SECONDARY_AUTH_STATE) is not an admin, used to prove the endpoint refuses
// anyone else.

const PRIMARY = 'dong';

/** Creates a real traveler at the given status through the fixture CLI. */
async function createTraveler(status) {
  const id = runId();
  const { travelerId } = await execFixtureCli('create-fillable-traveler', {
    createdBy: PRIMARY,
    title: `E2E Unarchive Traveler ${id}`,
    status,
  });
  return travelerId;
}

/** The traveler's current status, read straight from the database. */
async function travelerStatus(travelerId) {
  return (await execFixtureCli('get-traveler', { travelerId })).status;
}

/** Archives a traveler through the real status route, so statusBeforeArchive is captured. */
async function archiveViaStatusRoute(page, travelerId) {
  const res = await page.request.put(`/travelers/${travelerId}/status`, {
    data: { status: 4 },
  });
  expect(res.status()).toBe(200);
  expect(await travelerStatus(travelerId)).toBe(4);
}

test.describe('Admin Traveler Unarchive', () => {
  const SOURCE_STATUSES = [
    [0, 'Initialized'],
    [1, 'Active'],
    [2, 'Completed'],
  ];

  for (const [status, label] of SOURCE_STATUSES) {
    test(`admin restores a traveler archived from ${label} back to ${label}`, async ({
      page,
    }) => {
      const travelerId = await createTraveler(status);
      await archiveViaStatusRoute(page, travelerId);

      const res = await page.request.put(`/travelers/${travelerId}/unarchive`);
      expect(res.status()).toBe(200);
      expect(await travelerStatus(travelerId)).toBe(status);
    });
  }

  test('a traveler archived before this feature existed (no recorded prior status) falls back to Active', async ({
    page,
  }) => {
    const travelerId = await createTraveler(1);
    // Direct DB write, bypassing the status route entirely -- simulates a
    // traveler archived before statusBeforeArchive capture existed.
    await execFixtureCli('set-traveler-status', { travelerId, status: 4 });
    expect(await travelerStatus(travelerId)).toBe(4);

    const res = await page.request.put(`/travelers/${travelerId}/unarchive`);
    expect(res.status()).toBe(200);
    expect(await travelerStatus(travelerId)).toBe(1);
  });

  test('a non-admin cannot unarchive a traveler', async ({ page, browser }) => {
    const travelerId = await createTraveler(1);
    await archiveViaStatusRoute(page, travelerId);

    const nonAdminPage = await browser.newPage({
      storageState: SECONDARY_AUTH_STATE,
    });
    const res = await nonAdminPage.request.put(
      `/travelers/${travelerId}/unarchive`
    );
    expect(res.status()).toBe(403);
    await nonAdminPage.close();

    expect(await travelerStatus(travelerId)).toBe(4);
  });

  test('unarchiving a traveler that is not currently Archived is refused', async ({
    page,
  }) => {
    const travelerId = await createTraveler(1);

    const res = await page.request.put(`/travelers/${travelerId}/unarchive`);
    expect(res.status()).toBe(409);
    expect(await travelerStatus(travelerId)).toBe(1);
  });

  test('an admin sees and can click the Unarchive button on the traveler view page', async ({
    page,
  }) => {
    const travelerId = await createTraveler(1);
    await archiveViaStatusRoute(page, travelerId);

    await page.goto(`/travelers/${travelerId}/view`);
    await expect(page.locator('#unarchive')).toBeVisible();

    await page.click('#unarchive');
    await page.waitForURL(`**/travelers/${travelerId}/`);
    expect(await travelerStatus(travelerId)).toBe(1);
  });

  test('a non-admin does not see the Unarchive button on the traveler view page', async ({
    page,
    browser,
  }) => {
    const travelerId = await createTraveler(1);
    await archiveViaStatusRoute(page, travelerId);

    const nonAdminPage = await browser.newPage({
      storageState: SECONDARY_AUTH_STATE,
    });
    await nonAdminPage.goto(`/travelers/${travelerId}/view`);
    await expect(nonAdminPage.locator('#unarchive')).toHaveCount(0);
    await nonAdminPage.close();
  });
});
