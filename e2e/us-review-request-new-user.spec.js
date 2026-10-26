const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');

// The primary persona (dong) is the Form's owner/creator in every scenario
// here. The secondary persona (bob) plays the never-logged-in reviewer in
// the first scenario -- a real, already-authenticatable identity, but we
// delete their User record first to reproduce the actual "never logged in"
// condition, since global-setup.js logs bob in once before any spec runs.
// bob's roles are captured and restored afterward so this doesn't leak into
// any other spec in the same run (research.md R4, spec 127).
const REVIEWER_ID = 'bob';
const REVIEWER_DISPLAY_NAME = 'Bob Dalesio';
const REVIEWER_EMAIL = 'bob@example.com';

async function createDraftForm() {
  const id = runId();
  const { formId, v } = await execFixtureCli('create-review-form', {
    createdBy: 'dong',
    title: `Review Request Test Form ${id}`,
    documentNumber: `E2E-REVIEW-${id}`,
  });
  return { formId, v };
}

// Only used by the first scenario, where the reviewer must be recreated
// (via the real add-reviewer flow) before this returns -- if it weren't,
// restoring roles onto a User record that no longer exists would itself
// fail. The second scenario never recreates bob at all (that's the point
// of what it tests), so it does not use this helper.
async function withReviewerDeleted(fn) {
  const { roles: previousRoles } = await execFixtureCli('get-user', { userId: REVIEWER_ID }).catch(() => ({ roles: [] }));
  await execFixtureCli('delete-user', { userId: REVIEWER_ID });
  await fn();
  for (const role of previousRoles) {
    await execFixtureCli('grant-role', { userId: REVIEWER_ID, role });
  }
}

test.describe('US3 — Form reviewer add provisions a User record', () => {
  test('adding a never-logged-in reviewer via the typeahead succeeds and provisions them', async ({ page }) => {
    const { formId } = await createDraftForm();
    await execFixtureCli('set-form-status', { formId, status: 0.5 });

    await withReviewerDeleted(async () => {
      await page.goto(`/forms/${formId}/review/`);
      await page.fill('#username', REVIEWER_DISPLAY_NAME);
      await page.waitForSelector('.tt-suggestion', { timeout: 5000 });
      await page.click('.tt-suggestion');
      await expect(page.locator('#add')).toBeEnabled();

      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes(`/forms/${formId}/review/requests`) && resp.request().method() === 'POST'),
        page.click('#add'),
      ]);

      expect(response.status()).toBe(201);
      expect(response.request().postDataJSON().email).toBe(REVIEWER_EMAIL);

      const { roles } = await execFixtureCli('get-user', { userId: REVIEWER_ID });
      expect(roles).toBeTruthy();
    });
  });

  test('a stale review request whose reviewer has no User record does not crash the under-review notification', async ({ page }) => {
    const { formId, v } = await createDraftForm();
    // A synthetic id, never resolved via AD and never given a User record
    // by this test (deliberately) -- this scenario is about a reviewRequest
    // referencing nobody at all, so there is nothing to delete or restore.
    const staleReviewerId = `e2e-stale-reviewer-${runId()}`;

    await execFixtureCli('set-form-status', {
      formId,
      status: 0,
      reviewRequests: [{ _id: staleReviewerId, requestedOn: new Date().toISOString(), requestedBy: 'dong' }],
    });

    // Drive the real status transition that resolves reviewRequests to
    // emails for the "New Review Request" notification (routes/form.js).
    // Before the defensive fix, this threw a TypeError on the unresolved
    // reviewer's .email; it must now succeed instead.
    const response = await page.request.put(`/forms/${formId}/status`, {
      data: { status: 0.5, version: v },
    });

    expect(response.status()).toBe(200);
  });
});
