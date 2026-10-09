// RFC 0007: checkbox set options can be reordered in place with per-line
// Up/Down buttons. The first line's "up" and the last line's "down" are
// shown disabled rather than hidden, and the new order persists on save.
// Persona: primary (owner and admin) builds the form; no second user needed.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { createForm, getForm } = require('./fixtures/forms');
const { useScenarioHooks } = require('./fixtures/scenario');

useScenarioHooks(test);

async function addCheckboxToSet(page, text) {
  await page.click('#output .well.spec button[value="add_checkbox_button"]');
  await page
    .locator('.checkbox-set-controls .well.spec input[name="checkbox_text"]')
    .fill(text);
  await page.click('.checkbox-set-controls .well.spec button[type="submit"]');
}

async function saveAndWait(page) {
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.request().method() === 'PUT' && r.url().includes('/forms/')
    ),
    page.click('#save'),
  ]);
  if (response.status() === 200) {
    await page.waitForLoadState('load');
  }
  return response;
}

test('moving a checkbox option reorders it and saves the new order', async ({
  page,
}) => {
  const form = await createForm('primary', {
    title: `e2e checkbox move ${runId()}`,
  });
  await page.goto(`/forms/${form.id}/`);

  await page.click('#input-items');
  await page.click('#add-checkbox-set > a');
  await addCheckboxToSet(page, 'Alpha');
  await addCheckboxToSet(page, 'Bravo');
  await addCheckboxToSet(page, 'Charlie');

  const lineByText = text =>
    page.locator('.checkbox-set-controls .checkbox-in-set', { hasText: text });

  // first line's "up" is disabled, not hidden
  await lineByText('Alpha').hover();
  await expect(
    lineByText('Alpha').locator('a.btn[title="move the checkbox up"]')
  ).toHaveClass(/disabled/);

  // last line's "down" is disabled, not hidden
  await lineByText('Charlie').hover();
  await expect(
    lineByText('Charlie').locator('a.btn[title="move the checkbox down"]')
  ).toHaveClass(/disabled/);

  // move Charlie up one spot, ahead of Bravo
  await lineByText('Charlie')
    .locator('a.btn[title="move the checkbox up"]')
    .click();

  await expect(
    page.locator('.checkbox-set-controls .checkbox-in-set label.checkbox span')
  ).toHaveText(['Alpha', 'Charlie', 'Bravo']);

  // Charlie is now in the middle: neither of its move buttons is disabled
  await lineByText('Charlie').hover();
  await expect(
    lineByText('Charlie').locator('a.btn[title="move the checkbox up"]')
  ).not.toHaveClass(/disabled/);
  await expect(
    lineByText('Charlie').locator('a.btn[title="move the checkbox down"]')
  ).not.toHaveClass(/disabled/);

  await page.click('#output .well.spec button[type="submit"]');

  const response = await saveAndWait(page);
  expect(response.status(), 'saving the reordered checkbox set').toBe(200);

  const { html } = await getForm('primary', form.id);
  const order = ['Alpha', 'Bravo', 'Charlie'].sort(
    (a, b) => html.indexOf(a) - html.indexOf(b)
  );
  expect(order).toEqual(['Alpha', 'Charlie', 'Bravo']);
});
