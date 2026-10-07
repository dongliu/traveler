// Regression: duplicating a checkbox set must give every checkbox its own input
// name. Otherwise the copied checkboxes share one name and the server refuses
// the save with "duplicated input name".
// Persona: primary (owner and admin) builds the form; no second user needed.
const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { createForm, getForm } = require('./fixtures/forms');
const { useScenarioHooks } = require('./fixtures/scenario');

useScenarioHooks(test);

async function addCheckboxToSet(page) {
  await page.click('#output .well.spec button[value="add_checkbox_button"]');
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

function checkboxNames(html) {
  const tags = html.match(/<input\b[^>]*>/g) || [];
  return tags
    .filter(tag => /type="checkbox"/.test(tag))
    .map(tag => (tag.match(/name="([^"]*)"/) || [])[1]);
}

test('a duplicated checkbox set saves with a unique name for every checkbox', async ({
  page,
}) => {
  const form = await createForm('primary', {
    title: `e2e checkbox set ${runId()}`,
  });
  await page.goto(`/forms/${form.id}/`);

  await page.click('#input-items');
  await page.click('#add-checkbox-set > a');
  await addCheckboxToSet(page);
  await addCheckboxToSet(page);
  await page.click('#output .well.spec button[type="submit"]');

  const first = await saveAndWait(page);
  expect(first.status(), 'saving the checkbox set').toBe(200);

  const set = page.locator('#output .control-group-wrap', {
    has: page.locator('.checkbox-set'),
  });
  await set.hover();
  await set.locator('a.btn[title="duplicate"]').click();

  const second = await saveAndWait(page);
  expect(second.status(), 'saving the duplicated checkbox set').toBe(200);

  const names = checkboxNames((await getForm('primary', form.id)).html);
  expect(names).toHaveLength(4);
  expect(new Set(names).size).toBe(4);
});

function radioNames(html) {
  const tags = html.match(/<input\b[^>]*>/g) || [];
  return tags
    .filter(tag => /type="radio"/.test(tag))
    .map(tag => (tag.match(/name="([^"]*)"/) || [])[1]);
}

test('a duplicated radio group keeps its options together under a new name', async ({
  page,
}) => {
  const form = await createForm('primary', { title: `e2e radio ${runId()}` });
  await page.goto(`/forms/${form.id}/`);

  await page.click('#input-items');
  await page.click('#add-radio > a');
  await page.click('#output .well.spec button[value="add_radio_button"]');
  await page.click('#output .well.spec button[type="submit"]');

  const first = await saveAndWait(page);
  expect(first.status(), 'saving the radio group').toBe(200);

  const group = page.locator('#output .control-group-wrap', {
    has: page.locator('input[type="radio"]'),
  });
  await group.hover();
  await group.locator('a.btn[title="duplicate"]').click();

  const second = await saveAndWait(page);
  expect(second.status(), 'saving the duplicated radio group').toBe(200);

  const names = radioNames((await getForm('primary', form.id)).html);
  expect(names).toHaveLength(4);
  expect(names[0]).toBe(names[1]);
  expect(names[2]).toBe(names[3]);
  expect(names[0]).not.toBe(names[2]);
});
