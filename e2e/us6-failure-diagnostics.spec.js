// User Story 6: failure diagnostics.
// The forced failure below runs only when E2E_FORCE_FAILURE=1, so the default
// run stays green. Trace, video, and screenshot are kept on failure by the config.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { useScenarioHooks } = require('./fixtures/scenario');
const { createForm } = require('./fixtures/forms');

useScenarioHooks(test);

test.describe('User Story 6 - failure diagnostics', () => {
  test('AS1 a forced failure produces a trace, video, and screenshot', async ({
    page,
  }) => {
    await page.goto('/forms/new');
    test.skip(
      !process.env.E2E_FORCE_FAILURE,
      'set E2E_FORCE_FAILURE=1 to force this failure'
    );
    const form = await createForm('primary', {
      title: `e2e forced ${runId()}`,
    });
    expect(
      form.id,
      'step: create a draft form; expected a form id, got an empty id'
    ).toBe('');
  });
});
