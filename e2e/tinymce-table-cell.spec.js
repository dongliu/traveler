// Verification case: TinyMCE's link dialog inside a table cell's instruction
// editor must accept typed input. Regression for commit 283b027e, where
// Bootstrap 2's modal focus trap pulled focus out of the dialog.
// Persona: primary (owner and admin) builds the form; no second user needed.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { createForm, getForm } = require('./fixtures/forms');
const { useScenarioHooks } = require('./fixtures/scenario');

useScenarioHooks(test);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('instruction cell link dialog accepts a typed URL and saves it into the table', async ({
  page,
}) => {
  const tag = runId();
  const form = await createForm('primary', {
    title: `e2e tinymce table cell ${tag}`,
  });
  const url = `https://example.com/${tag}`;

  await page.goto(`/forms/${form.id}/`);
  await page.click('#input-items');
  await page.click('#add-table > a');

  const modal = page.locator('#modal');
  await page
    .locator(
      '.control-group-wrap[data-status="editing"] .form-table td:not(.table-row-ctrl)'
    )
    .first()
    .click();
  await expect(modal).toBeVisible();

  await page.selectOption('#cell-type-select', 'instruction');
  await page.waitForFunction(() => {
    const editor =
      window.tinymce && window.tinymce.get('cell-instruction-editor');
    return Boolean(editor && editor.initialized);
  });

  await modal.locator('.tox-tinymce button[title="Insert/edit link"]').click();

  const dialog = page.locator('.tox-silver-sink .tox-dialog');
  await expect(dialog).toBeVisible();
  const urlField = dialog.getByLabel('URL', { exact: true });
  await urlField.click();
  await page.keyboard.type(url);
  await expect(urlField).toHaveValue(url);

  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  await modal.locator('button[value="complete"]').click();
  await expect(modal).toBeHidden();

  await page.locator('.table-done-btn').click();
  const reloaded = page.waitForEvent('load');
  await page.click('#save');
  await reloaded;

  const saved = await getForm('primary', form.id);
  expect(saved.html).toContain('data-cell-type="instruction"');
  expect(saved.html).toMatch(new RegExp(`href="${escapeRegExp(url)}"`));
});
