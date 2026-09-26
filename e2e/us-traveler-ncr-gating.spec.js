const { test, expect } = require('@playwright/test');
const { runId } = require('./fixtures/run-id');
const { execFixtureCli } = require('./fixtures/exec-cli');
const { SECONDARY_AUTH_STATE } = require('./fixtures/auth-state');
const { resolveEnv } = require('./fixtures/env');
const {
  fillAndSaveInput,
  fillNcrForm,
  completeNcrCreation,
  ncrRequestBody,
} = require('./fixtures/ncr-ui');

// Spec 124 — traveler input NCR gating and closure record.
//
// The primary persona (dong) is the traveler's owner AND an admin, so the
// default logged-in page can drive the real traveler UI. The secondary persona
// (bob) is a plain user.
//
// NOTE on read access: every authenticated user gets auth.default_roles
// unioned into their roles (lib/auth/ldap.js), and in this Docker
// configuration that includes a role granting write_active_travelers, which
// gives write access to EVERY traveler whatever its publicAccess
// (lib/req-utils.js getAccess). So no e2e persona can lack read access, and the
// "no read access is answered exactly like a nonexistent traveler" rule
// (spec FR-008) cannot be reached here — it is covered at unit level in
// test-unit/lib/traveler-ncr.test.js, with canRead stubbed.
//
// Route/UI behaviour is covered here rather than in a supertest-style harness
// because this repository has none (specs/124 research.md Decision 12).

const PRIMARY = 'dong';
// A valid-looking ObjectId that is not a traveler.
const UNKNOWN_TRAVELER_ID = '507f1f77bcf86cd799439011';

/** Creates a real, writable traveler through the fixture CLI. */
async function createTraveler(overrides = {}) {
  const id = runId();
  const title = overrides.title || `E2E Gating Traveler ${id}`;
  const { travelerId } = await execFixtureCli('create-fillable-traveler', {
    createdBy: PRIMARY,
    ...overrides,
    title,
  });
  return { travelerId, title, id };
}

/** A traveler with three text inputs (A, B, C) and one checkbox inside a set (D). */
function fourInputs(id) {
  return [
    { name: 'input_a', label: `Input A ${id}` },
    { name: 'input_b', label: `Input B ${id}` },
    { name: 'input_c', label: `Input C ${id}` },
    { name: 'check_d', label: `Check D ${id}`, kind: 'checkbox-in-set' },
  ];
}

test.describe('US1 — link an NCR to a traveler input by reference', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('a Copy NCR reference control is offered at every input — filled or not, and inside a checkbox set', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_a', 'a measured value');

    // A (filled), B and C (unfilled), D (a checkbox in a set)
    await expect(page.locator('.copy-ncr-ref')).toHaveCount(4);
    // "Initiate NCR" stays limited to the one filled input (spec 123)
    await expect(page.locator('.initiate-ncr-link')).toHaveCount(1);
  });

  test('the control sits to the right of its input, on the same row', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    // Measure only once the page has stopped moving: each input's notes row is
    // added after the first paint and pushes the inputs below it down, so a
    // position read before then is stale by the time the button is read.
    await expect(page.locator('.copy-ncr-ref')).toHaveCount(4);
    await expect(page.locator('.note-buttons')).toHaveCount(4);

    // a text input (A) and a checkbox (D): the button is beside the field, not below it
    for (const [index, field] of [
      [0, 'input[name="input_a"]'],
      [3, 'input[name="check_d"]'],
    ]) {
      const input = await page.locator(field).boundingBox();
      const control = await page
        .locator('.copy-ncr-ref')
        .nth(index)
        .boundingBox();
      expect(control.x).toBeGreaterThanOrEqual(input.x + input.width);
      // the two overlap vertically — one row
      expect(control.y).toBeLessThan(input.y + input.height);
      expect(control.y + control.height).toBeGreaterThan(input.y);
    }
  });

  test('clicking the control reveals the reference in a popup, with a button that copies it', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);

    // nothing is shown, and nothing copied, until the control is clicked
    await expect(page.locator('.ncr-ref-popover')).toHaveCount(0);
    await page
      .locator('.copy-ncr-ref')
      .first()
      .click();
    const popup = page.locator('.ncr-ref-popover');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.ncr-ref-value')).toHaveValue(
      `${travelerId}::input_a`
    );

    // the Copy button in the popup puts the reference on the clipboard
    await popup.locator('.ncr-ref-copy').click();
    await expect(popup.locator('.ncr-ref-copy')).toContainText('Copied');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${travelerId}::input_a`);
  });

  test('the reference in the popup is selected, so it can also be copied by hand', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);
    await page
      .locator('.copy-ncr-ref')
      .first()
      .click();

    const selected = await page
      .locator('.ncr-ref-popover .ncr-ref-value')
      .evaluate(field => field.value.slice(field.selectionStart, field.selectionEnd));
    expect(selected).toBe(`${travelerId}::input_a`);
    await page.keyboard.press('ControlOrMeta+c');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${travelerId}::input_a`
    );
  });

  test('the popup closes on Escape, on a click elsewhere, and on the control again; one is open at a time', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto(`/travelers/${travelerId}/`);
    const controls = page.locator('.copy-ncr-ref');
    const popup = page.locator('.ncr-ref-popover');

    await controls.nth(0).click();
    await expect(popup).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);

    await controls.nth(0).click();
    await expect(popup).toBeVisible();
    await controls.nth(0).click();
    await expect(popup).toHaveCount(0);

    await controls.nth(0).click();
    await expect(popup).toBeVisible();
    await page.locator('h3', { hasText: 'Traveler title' }).click();
    await expect(popup).toHaveCount(0);

    // opening another input's popup replaces the first (the first popup covers
    // the rows just below its own, so use the last input, which it leaves clear)
    await controls.nth(0).click();
    await controls.nth(3).click();
    await expect(popup).toHaveCount(1);
    await expect(popup.locator('.ncr-ref-value')).toHaveValue(
      `${travelerId}::check_d`
    );
  });

  test('a pasted reference shows the traveler and input, and the submitted NCR is linked to that exact input', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId, title } = await createTraveler({
      inputs: fourInputs(id),
    });
    await page.goto(`/travelers/${travelerId}/`);
    await page
      .locator('.copy-ncr-ref')
      .nth(1)
      .click(); // input B, unfilled
    await page.locator('.ncr-ref-popover .ncr-ref-copy').click();
    const reference = await page.evaluate(() => navigator.clipboard.readText());
    expect(reference).toBe(`${travelerId}::input_b`);

    await page.goto('/ncrs/new');
    await page.fill('#traveler_input_ref', reference);
    await page.locator('#traveler_input_ref').blur();
    await expect(page.locator('#traveler-ref-preview')).toContainText(title);
    await expect(page.locator('#traveler-ref-preview')).toContainText(
      `Input B ${id}`
    );

    const ncrId = await completeNcrCreation(page, `PN-${id}`);
    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['ncr_number', 'traveler_link'],
    });
    expect(ncr.traveler_link).toMatchObject({
      traveler_id: travelerId,
      input_name: 'input_b',
      input_label: `Input B ${id}`,
      initiated_from_traveler: true,
    });

    // the link shows on the traveler, at that input
    await page.goto(`/travelers/${travelerId}/`);
    await expect(page.locator('.ncr-link-badge')).toContainText(ncr.ncr_number);
  });

  test('"Initiate NCR" on a filled input opens the form with the same reference field already filled', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId, title } = await createTraveler({
      inputs: fourInputs(id),
    });
    await page.goto(`/travelers/${travelerId}/`);
    await fillAndSaveInput(page, 'input_a', 'a measured value');

    await page.click('.initiate-ncr-link');
    await page.waitForURL(/\/ncrs\/new\?traveler_input_ref=/);
    await expect(page.locator('#traveler_input_ref')).toHaveValue(
      `${travelerId}::input_a`
    );
    await expect(page.locator('#traveler-ref-preview')).toContainText(title);
    await expect(page.locator('#traveler-ref-preview')).toContainText(
      `Input A ${id}`
    );
  });

  test('leaving the reference blank still creates a standalone NCR with no traveler link', async ({
    page,
  }) => {
    const id = runId();
    await page.goto('/ncrs/new');
    await expect(page.locator('#traveler_input_ref')).toHaveValue('');

    const ncrId = await completeNcrCreation(page, `PN-${id}`);
    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['traveler_link'],
    });
    const link = ncr.traveler_link || {};
    expect(link.traveler_id).toBeUndefined();
    expect(link.initiated_from_traveler).toBeFalsy();
  });

  test('a malformed or unresolvable reference is refused with a specific message and creates nothing', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto('/ncrs/new');
    await fillNcrForm(page, `PN-${id}`);

    const cases = [
      ['abc', 'Enter the reference as traveler_id::input_name.'],
      ['::input_a', 'Enter the reference as traveler_id::input_name.'],
      [`${travelerId}::`, 'Enter the reference as traveler_id::input_name.'],
      [`${travelerId}::no_such_input`, 'has no input named "no_such_input"'],
      [
        `${UNKNOWN_TRAVELER_ID}::input_a`,
        'No traveler matches this reference.',
      ],
    ];
    for (const [reference, expected] of cases) {
      await page.fill('#traveler_input_ref', reference);
      await page.click('#submit-btn');
      await expect(page.locator('#ncr-error')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#ncr-error-msg')).toContainText(expected);
      await expect(page.locator('#ncr-success')).toBeHidden();
    }
  });

  test('a reference wrapped in stray whitespace still works', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
    await page.goto('/ncrs/new');
    await page.fill('#traveler_input_ref', `   ${travelerId}::input_c   `);

    const ncrId = await completeNcrCreation(page, `PN-${id}`);
    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId,
      fields: ['traveler_link'],
    });
    expect(ncr.traveler_link.traveler_id).toBe(travelerId);
    expect(ncr.traveler_link.input_name).toBe('input_c');
  });
});

test.describe('US1 — the API enforces the rules, not just the form', () => {
  test('the deprecated 123 fields still link, through the same resolver; the client-supplied label is ignored', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

    const res = await page.request.post('/api/ncrs', {
      data: ncrRequestBody(id, {
        traveler_id: travelerId,
        traveler_input_name: 'input_a',
        traveler_input_label: 'FORGED LABEL',
      }),
    });
    expect(res.status()).toBe(201);
    const { ncr } = await execFixtureCli('get-ncr', {
      ncrId: (await res.json()).ncr.ncr_id,
      fields: ['traveler_link'],
    });
    expect(ncr.traveler_link.input_name).toBe('input_a');
    expect(ncr.traveler_link.input_label).toBe(`Input A ${id}`);
  });

  test('a traveler_id with no input name is refused (an NCR links to an input, not just a traveler)', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

    const res = await page.request.post('/api/ncrs', {
      data: ncrRequestBody(id, { traveler_id: travelerId }),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('BAD_REFERENCE');
    expect(body.details.traveler_input_ref).toHaveLength(1);
  });

  test('a bad reference is refused with the right code and status, and creates nothing', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

    const attempts = [
      [{ traveler_input_ref: 'abc' }, 400, 'BAD_REFERENCE'],
      [
        { traveler_input_ref: `${travelerId}::no_such_input` },
        404,
        'INPUT_NOT_FOUND',
      ],
      [
        { traveler_input_ref: `${UNKNOWN_TRAVELER_ID}::input_a` },
        404,
        'TRAVELER_NOT_FOUND',
      ],
    ];
    for (const [fields, status, code] of attempts) {
      const res = await page.request.post('/api/ncrs', {
        data: ncrRequestBody(id, fields),
      });
      expect(res.status()).toBe(status);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe(code);
      expect(body.ncr).toBeUndefined();
    }
  });

  test('required-field validation still comes first', async ({ page }) => {
    const id = runId();
    const res = await page.request.post('/api/ncrs', {
      data: ncrRequestBody(id, { quantity: 0, traveler_input_ref: 'abc' }),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.details.quantity).toBeDefined();
    expect(body.details.traveler_input_ref).toBeUndefined();
  });

  test('the lookup endpoint describes a valid reference and reports each failure with its code', async ({
    page,
  }) => {
    const id = runId();
    const { travelerId, title } = await createTraveler({
      inputs: fourInputs(id),
    });
    const lookup = ref =>
      page.request.get('/api/ncrs/traveler-input', {
        params: ref === undefined ? {} : { ref },
      });

    const ok = await lookup(`${travelerId}::input_a`);
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({
      success: true,
      traveler: { id: travelerId, title, status: 1, status_label: 'active' },
      input: { name: 'input_a', label: `Input A ${id}` },
    });

    const noRef = await lookup(undefined);
    expect(noRef.status()).toBe(400);
    expect((await noRef.json()).code).toBe('BAD_REFERENCE');
    expect((await (await lookup('abc')).json()).code).toBe('BAD_REFERENCE');
    expect((await (await lookup(`${travelerId}::nope`)).json()).code).toBe(
      'INPUT_NOT_FOUND'
    );
    expect(
      (await (await lookup(`${UNKNOWN_TRAVELER_ID}::input_a`)).json()).code
    ).toBe('TRAVELER_NOT_FOUND');
  });
});

test.describe(
  'US2 — NCRs can only be initiated against an active traveler',
  () => {
    const NON_ACTIVE = [
      [0, 'initialized'],
      [1.5, 'submitted for completion'],
      [2, 'completed'],
      [3, 'frozen'],
      [4, 'archived'],
    ];

    for (const [status, label] of NON_ACTIVE) {
      test(`a ${label} traveler: no Initiate NCR action, and a reference to it is refused naming the status`, async ({
        page,
      }) => {
        const id = runId();
        const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
        // fill an input while the traveler is active, then move it out of active, so
        // the missing action is down to the status and not to an empty input
        await page.goto(`/travelers/${travelerId}/`);
        await fillAndSaveInput(page, 'input_a', 'a measured value');
        await execFixtureCli('set-traveler-status', { travelerId, status });

        // An archived traveler's page redirects to /view using an absolute URL
        // built from the configured auth service (routes/traveler.js
        // redirectPreview) — under Docker that is the container's own port, which
        // the browser cannot reach. /view is the page such a traveler is meant to
        // land on, and it runs the same per-input code, so open it directly.
        await page.goto(
          status === 4
            ? `/travelers/${travelerId}/view`
            : `/travelers/${travelerId}/`
        );
        await expect(page.locator('.initiate-ncr-link')).toHaveCount(0);
        // the reference can still be copied from any traveler, whatever its status
        await expect(page.locator('.copy-ncr-ref').first()).toBeVisible();

        await page.goto('/ncrs/new');
        await page.fill('#traveler_input_ref', `${travelerId}::input_a`);
        await page.locator('#traveler_input_ref').blur();
        await expect(page.locator('#traveler-ref-preview')).toContainText(
          `is ${label}`
        );

        await fillNcrForm(page, `PN-${id}`);
        await page.click('#submit-btn');
        await expect(page.locator('#ncr-error-msg')).toContainText(
          `is ${label}`
        );
        await expect(page.locator('#ncr-success')).toBeHidden();
      });
    }

    test('the status at the moment of submission decides, not the status when the form was opened', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

      await page.goto('/ncrs/new');
      await page.fill('#traveler_input_ref', `${travelerId}::input_a`);
      await page.locator('#traveler_input_ref').blur();
      await expect(page.locator('#traveler-ref-preview')).toContainText(
        `Input A ${id}`
      );

      // the traveler is submitted for completion while the form sits open
      await execFixtureCli('set-traveler-status', { travelerId, status: 1.5 });

      await fillNcrForm(page, `PN-${id}`);
      await page.click('#submit-btn');
      await expect(page.locator('#ncr-error-msg')).toContainText(
        'is submitted for completion'
      );
      await expect(page.locator('#ncr-success')).toBeHidden();
    });

    test('an active traveler is accepted on both paths — by reference and via Initiate NCR', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

      // by reference
      await page.goto('/ncrs/new');
      await page.fill('#traveler_input_ref', `${travelerId}::input_b`);
      const byReference = await completeNcrCreation(page, `PN-${id}-ref`);

      // via the traveler's own "Initiate NCR" action
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      await page.click('.initiate-ncr-link');
      await page.waitForURL(/\/ncrs\/new\?traveler_input_ref=/);
      const viaInitiate = await completeNcrCreation(page, `PN-${id}-init`);

      for (const [ncrId, inputName] of [
        [byReference, 'input_b'],
        [viaInitiate, 'input_a'],
      ]) {
        const { ncr } = await execFixtureCli('get-ncr', {
          ncrId,
          fields: ['traveler_link'],
        });
        expect(ncr.traveler_link).toMatchObject({
          traveler_id: travelerId,
          input_name: inputName,
        });
      }
    });

    test('the API and the lookup endpoint refuse a non-active traveler with 409 TRAVELER_NOT_ACTIVE', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({
        inputs: fourInputs(id),
        status: 2,
      });
      const ref = `${travelerId}::input_a`;

      const created = await page.request.post('/api/ncrs', {
        data: ncrRequestBody(id, { traveler_input_ref: ref }),
      });
      expect(created.status()).toBe(409);
      const body = await created.json();
      expect(body).toMatchObject({
        success: false,
        code: 'TRAVELER_NOT_ACTIVE',
      });
      expect(body.message).toContain('is completed');
      expect(body.ncr).toBeUndefined();

      const lookup = await page.request.get('/api/ncrs/traveler-input', {
        params: { ref },
      });
      expect(lookup.status()).toBe(409);
      expect((await lookup.json()).code).toBe('TRAVELER_NOT_ACTIVE');
    });
  }
);

/** An NCR linked to one input of a traveler, created directly through the fixture CLI. */
function createLinkedNcr(
  id,
  { travelerId, inputName, inputLabel, status = 'Submitted' }
) {
  return execFixtureCli('create-traveler-linked-ncr', {
    ncrData: {
      part_name: `Gate Part ${id}`,
      part_number: `PN-${id}`,
      wbs_number: `WBS-${id}`,
      supplier_name: `Supplier ${id}`,
      originator_id: PRIMARY,
      originator_name: 'Dong Liu',
      description_of_nonconformance: `Gate test ${id}, exceeding twenty characters.`,
    },
    status,
    travelerId,
    inputName,
    inputLabel,
  });
}

/** The traveler's current status, read straight from the database. */
async function travelerStatus(travelerId) {
  return (await execFixtureCli('get-traveler', { travelerId })).status;
}

test.describe(
  'US3 — an open NCR blocks submission for completion approval',
  () => {
    test('an open NCR refuses the submission, lists it with a link, and leaves the form editable — even for an administrator', async ({
      page,
    }) => {
      // the primary persona is an admin: the refusal has no override
      const { roles } = await execFixtureCli('get-user', { userId: PRIMARY });
      expect(roles).toContain('admin');

      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const ncr = await createLinkedNcr(id, {
        travelerId,
        inputName: 'input_a',
        inputLabel: `Input A ${id}`,
      });

      await page.goto(`/travelers/${travelerId}/`);
      await page.click('#complete2');

      const alert = page.locator('#message .alert-error');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(
        'cannot be submitted for completion approval'
      );
      const link = alert.locator('.open-ncrs a');
      await expect(link).toHaveText(ncr.ncr_number);
      await expect(link).toHaveAttribute(
        'href',
        new RegExp(`/ncrs/${ncr.ncrId}$`)
      );
      await expect(alert.locator('.open-ncrs li')).toContainText('Submitted');
      await expect(alert.locator('.open-ncrs li')).toContainText(
        `Input A ${id}`
      );

      // the traveler stays active, and the form was not left disabled
      expect(await travelerStatus(travelerId)).toBe(1);
      await expect(page.locator('input[name="input_a"]')).toBeEnabled();
    });

    test('every linked NCR must be Closed before the traveler can be submitted', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const first = await createLinkedNcr(id, {
        travelerId,
        inputName: 'input_a',
        inputLabel: `Input A ${id}`,
      });
      const second = await createLinkedNcr(id, {
        travelerId,
        inputName: 'input_b',
        inputLabel: `Input B ${id}`,
      });

      await page.goto(`/travelers/${travelerId}/`);
      await page.click('#complete2');
      await expect(page.locator('.open-ncrs li')).toHaveCount(2);

      // closing one is not enough
      await execFixtureCli('set-ncr-status', {
        ncrId: first.ncrId,
        status: 'Closed',
      });
      await page.reload();
      await page.click('#complete2');
      await expect(page.locator('.open-ncrs li')).toHaveCount(1);
      await expect(page.locator('.open-ncrs a')).toHaveText(second.ncr_number);
      expect(await travelerStatus(travelerId)).toBe(1);

      // with every linked NCR Closed, submission goes through
      await execFixtureCli('set-ncr-status', {
        ncrId: second.ncrId,
        status: 'Closed',
      });
      await page.reload();
      await page.click('#complete2');
      await expect
        .poll(() => travelerStatus(travelerId), { timeout: 10000 })
        .toBe(1.5);
    });

    test('an NCR linked to a different traveler does not block this one', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const other = await createTraveler({ inputs: fourInputs(id) });
      await createLinkedNcr(id, {
        travelerId: other.travelerId,
        inputName: 'input_a',
        inputLabel: `Input A ${id}`,
      });

      await page.goto(`/travelers/${travelerId}/`);
      await page.click('#complete2');
      await expect
        .poll(() => travelerStatus(travelerId), { timeout: 10000 })
        .toBe(1.5);
    });

    test('a traveler sent back for more work is checked again when it is resubmitted', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });

      // first submission: no NCR, so it goes through
      await page.goto(`/travelers/${travelerId}/`);
      await page.click('#complete2');
      await expect
        .poll(() => travelerStatus(travelerId), { timeout: 10000 })
        .toBe(1.5);

      // sent back for more work; an NCR is raised while it is active again
      await execFixtureCli('set-traveler-status', { travelerId, status: 1 });
      await createLinkedNcr(id, {
        travelerId,
        inputName: 'input_a',
        inputLabel: `Input A ${id}`,
      });

      await page.goto(`/travelers/${travelerId}/`);
      await page.click('#complete2');
      await expect(
        page.locator('#message .alert-error .open-ncrs li')
      ).toHaveCount(1);
      expect(await travelerStatus(travelerId)).toBe(1);
    });

    test('the status route answers 409 OPEN_NCRS with the open NCRs, and does not change the status', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const ncr = await createLinkedNcr(id, {
        travelerId,
        inputName: 'input_a',
        inputLabel: `Input A ${id}`,
      });

      const res = await page.request.put(`/travelers/${travelerId}/status`, {
        data: { status: 1.5 },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        code: 'OPEN_NCRS',
        error: 'Conflict',
      });
      expect(body.open_ncrs).toEqual([
        {
          ncr_id: ncr.ncrId,
          ncr_number: ncr.ncr_number,
          status: 'Submitted',
          input_name: 'input_a',
          input_label: `Input A ${id}`,
        },
      ]);
      expect(await travelerStatus(travelerId)).toBe(1);
    });

    test('approval is deliberately not gated — the rule is enforced at submission only', async ({
      page,
    }) => {
      // A traveler that is already submitted but somehow has an open NCR (a legacy
      // record, or a create and a submit that landed at the same instant). NCRs can
      // only be initiated against an active traveler, so this cannot arise in normal
      // operation; approving it is not blocked (spec 124 Assumptions).
      const id = runId();
      const { travelerId } = await createTraveler({
        inputs: fourInputs(id),
        status: 1.5,
      });
      await createLinkedNcr(id, {
        travelerId,
        inputName: 'input_a',
        inputLabel: `Input A ${id}`,
      });

      const res = await page.request.put(`/travelers/${travelerId}/status`, {
        data: { status: 2 },
      });
      expect(res.status()).toBe(200);
      expect(await travelerStatus(travelerId)).toBe(2);
    });
  }
);

/** The finished-input figure stored on the traveler — the one lists and binders read. */
async function storedFinished(travelerId) {
  return (await execFixtureCli('get-traveler', { travelerId })).finishedInput;
}

/** Creates an NCR linked to an input through the real API, by reference. */
async function createNcrByReference(page, id, travelerId, inputName) {
  const res = await page.request.post('/api/ncrs', {
    data: ncrRequestBody(id, {
      traveler_input_ref: `${travelerId}::${inputName}`,
    }),
  });
  expect(res.status()).toBe(201);
  return (await res.json()).ncr.ncr_id;
}

test.describe(
  'US4 — an input with an open NCR does not count as finished',
  () => {
    test('raising an NCR from a filled input lowers the finished count and lists the NCR in a warning box; editing still works', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      await fillAndSaveInput(page, 'input_b', 'another value');
      expect(await storedFinished(travelerId)).toBe(2);
      await expect(page.locator('#finished-input')).toHaveText('2');

      // raise an NCR from input A through the real UI
      await page
        .locator('.initiate-ncr-link')
        .first()
        .click();
      await completeNcrCreation(page, `PN-${id}`);

      await page.goto(`/travelers/${travelerId}/`);
      expect(await storedFinished(travelerId)).toBe(1);
      await expect(page.locator('#finished-input')).toHaveText('1');
      // the NCR is listed at input A, in a warning box — there is no separate
      // "not finished" tag any more
      const box = page
        .locator('.control-group', {
          has: page.locator('input[name="input_a"]'),
        })
        .locator('.ncr-links-existing');
      await expect(box).toHaveCount(1);
      await expect(box).toHaveClass(/\balert\b/);
      await expect(box.locator('.ncr-link-badge')).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText('Not finished');

      // editing the input is still allowed, and the figure does not move
      await fillAndSaveInput(page, 'input_a', 'a corrected value');
      expect(await storedFinished(travelerId)).toBe(1);
    });

    test('an unfilled input linked by reference stays unfinished after it is filled in', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      expect(await storedFinished(travelerId)).toBe(1);

      // an NCR against the still-empty input C changes nothing yet
      await createNcrByReference(page, id, travelerId, 'input_c');
      expect(await storedFinished(travelerId)).toBe(1);

      // filling C in: neither the page nor the server counts it while its NCR is open
      await page.goto(`/travelers/${travelerId}/`);
      await expect(page.locator('#finished-input')).toHaveText('1');
      await fillAndSaveInput(page, 'input_c', 'now filled');
      await expect(page.locator('#finished-input')).toHaveText('1');
      expect(await storedFinished(travelerId)).toBe(1);

      await page.reload();
      await expect(page.locator('#finished-input')).toHaveText('1');
      // C's open NCR is listed in its warning box (no other input has one)
      await expect(page.locator('.ncr-links-existing')).toHaveCount(1);
    });

    test('a later save on another input does not quietly un-block an input that still has an open NCR', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      await fillAndSaveInput(page, 'input_b', 'another value');
      await createNcrByReference(page, id, travelerId, 'input_a');
      expect(await storedFinished(travelerId)).toBe(1);

      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_b', 'edited value'); // every data save recounts
      expect(await storedFinished(travelerId)).toBe(1);
    });

    test('closing the NCR through the real close endpoint makes the input count again', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      await fillAndSaveInput(page, 'input_b', 'another value');
      const ncrId = await createNcrByReference(page, id, travelerId, 'input_a');
      expect(await storedFinished(travelerId)).toBe(1);

      // the raiser (dong) is the originator, so may close it once it is at Final Approval
      await execFixtureCli('set-ncr-status', {
        ncrId,
        status: 'Final Approval',
      });
      const closed = await page.request.patch(`/api/ncrs/${ncrId}/close`, {
        data: {
          disposition_execution_verified: true,
          traveler_signed_off: true,
        },
      });
      expect(closed.status()).toBe(200);

      expect(await storedFinished(travelerId)).toBe(2);
      await page.goto(`/travelers/${travelerId}/`);
      await expect(page.locator('#finished-input')).toHaveText('2');
      // the closed NCR is still listed for the input, now as Closed
      await expect(page.locator('.ncr-links-existing .badge')).toHaveText(
        'Closed'
      );
    });

    test('an input stays unfinished until every one of its NCRs is Closed', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      const first = await createNcrByReference(page, id, travelerId, 'input_a');
      await createNcrByReference(page, id, travelerId, 'input_a');
      expect(await storedFinished(travelerId)).toBe(0);

      await execFixtureCli('set-ncr-status', {
        ncrId: first,
        status: 'Final Approval',
      });
      const closed = await page.request.patch(`/api/ncrs/${first}/close`, {
        data: {
          disposition_execution_verified: true,
          traveler_signed_off: true,
        },
      });
      expect(closed.status()).toBe(200);

      // one of its two NCRs is still open
      expect(await storedFinished(travelerId)).toBe(0);
    });

    test('a binder holding the traveler follows: its rolled-up figure drops and recovers with the NCR', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      await fillAndSaveInput(page, 'input_b', 'another value');
      const { binderId } = await execFixtureCli('create-binder-with-traveler', {
        travelerId,
        createdBy: PRIMARY,
      });
      const binderFinished = async () =>
        (await execFixtureCli('get-binder', { binderId })).finishedInput;
      expect(await binderFinished()).toBe(2);

      // the binder reads the figure the traveler stores, so it must move with it
      const ncrId = await createNcrByReference(page, id, travelerId, 'input_a');
      await expect.poll(binderFinished, { timeout: 10000 }).toBe(1);

      await closeNcrViaApi(page, ncrId);
      await expect.poll(binderFinished, { timeout: 10000 }).toBe(2);
    });

    test('deleting an open NCR as an administrator makes the input count again', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      await page.goto(`/travelers/${travelerId}/`);
      await fillAndSaveInput(page, 'input_a', 'a measured value');
      const ncrId = await createNcrByReference(page, id, travelerId, 'input_a');
      expect(await storedFinished(travelerId)).toBe(0);

      const deleted = await page.request.delete(`/api/ncrs/${ncrId}`);
      expect(deleted.status()).toBe(200);

      expect(await storedFinished(travelerId)).toBe(1);
      await page.goto(`/travelers/${travelerId}/`);
      await expect(page.locator('#finished-input')).toHaveText('1');
    });
  }
);

/**
 * Takes an NCR to Final Approval and closes it through the real close endpoint,
 * as its originator (dong). Resolves to the response body.
 */
async function closeNcrViaApi(page, ncrId) {
  await execFixtureCli('set-ncr-status', { ncrId, status: 'Final Approval' });
  const res = await page.request.patch(`/api/ncrs/${ncrId}/close`, {
    data: { disposition_execution_verified: true, traveler_signed_off: true },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

async function listPdfs(request, travelerId) {
  const res = await request.get(`/travelers/${travelerId}/ncr-pdfs/`);
  expect(res.status()).toBe(200);
  return res.json();
}

async function ncrEvents(ncrId) {
  const { ncr } = await execFixtureCli('get-ncr', {
    ncrId,
    fields: ['events', 'status', 'ncr_number'],
  });
  return ncr;
}

test.describe(
  'US5 — a closed NCR leaves a PDF record on the traveler input',
  () => {
    test('closing a traveler-linked NCR attaches a PDF to the input, and it can be opened', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const ncrId = await createNcrByReference(page, id, travelerId, 'input_a');

      const closed = await closeNcrViaApi(page, ncrId);
      expect(closed.closure_pdf.status).toBe('attached');
      expect(closed.closure_pdf.pdf_id).toBeTruthy();

      // listed, named for the NCR
      const pdfs = await listPdfs(page.request, travelerId);
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0]).toMatchObject({
        input_name: 'input_a',
        ncr_id: ncrId,
        file_name: `${closed.ncr.ncr_number}.pdf`,
        ncr_number: closed.ncr.ncr_number,
      });
      expect(pdfs[0].generated_on).toBeTruthy();

      // served as a real PDF, inline, named for the NCR
      const file = await page.request.get(
        `/travelers/${travelerId}/ncr-pdfs/${pdfs[0].pdf_id}`
      );
      expect(file.status()).toBe(200);
      expect(file.headers()['content-type']).toContain('application/pdf');
      expect(file.headers()['content-disposition']).toContain('inline');
      expect(file.headers()['content-disposition']).toContain(
        `${closed.ncr.ncr_number}.pdf`
      );
      const bytes = await file.body();
      expect(bytes.slice(0, 5).toString('latin1')).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(1500);

      // the NCR records that it was attached
      const ncr = await ncrEvents(ncrId);
      const attached = ncr.events.find(
        e => e.event_type === 'traveler.pdf_attached'
      );
      expect(attached).toBeTruthy();
      expect(attached.actor_type).toBe('system');
      expect(attached.payload).toMatchObject({
        traveler_id: travelerId,
        input_name: 'input_a',
        file_name: `${closed.ncr.ncr_number}.pdf`,
      });

      // and it shows at that input on the traveler, on the same row as the NCR
      // link, after "Close report: "
      await page.goto(`/travelers/${travelerId}/`);
      const number = closed.ncr.ncr_number;
      const row = page.locator('.ncr-link-row');
      await expect(row).toHaveCount(1);
      await expect(row.locator('.ncr-link-badge')).toContainText(number);
      await expect(row).toContainText(`${number} Close report: ${number}.pdf`);
      const link = page.locator('.ncr-pdf-link');
      await expect(link).toHaveCount(1);
      await expect(link).toContainText(`${closed.ncr.ncr_number}.pdf`);
      await expect(link).toHaveAttribute(
        'href',
        new RegExp(`/ncr-pdfs/${pdfs[0].pdf_id}$`)
      );
      await expect(
        page
          .locator('.control-group', {
            has: page.locator('input[name="input_a"]'),
          })
          .locator('.ncr-pdf-link')
      ).toHaveCount(1);
    });

    test('a user who can only view the traveler sees the PDF and can open it', async ({
      page,
      browser,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const ncrId = await createNcrByReference(page, id, travelerId, 'input_a');
      const closed = await closeNcrViaApi(page, ncrId);

      const viewer = await browser.newPage({
        storageState: SECONDARY_AUTH_STATE,
      });
      await viewer.goto(`/travelers/${travelerId}/`);
      await expect(viewer.locator('.ncr-pdf-link')).toContainText(
        `${closed.ncr.ncr_number}.pdf`
      );
      const pdfs = await listPdfs(viewer.request, travelerId);
      const file = await viewer.request.get(
        `/travelers/${travelerId}/ncr-pdfs/${pdfs[0].pdf_id}`
      );
      expect(file.status()).toBe(200);
      expect((await file.body()).slice(0, 5).toString('latin1')).toBe('%PDF-');
      await viewer.close();
    });

    test('several closed NCRs on one input each keep their own PDF', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const first = await createNcrByReference(page, id, travelerId, 'input_a');
      const second = await createNcrByReference(
        page,
        id,
        travelerId,
        'input_a'
      );

      const firstClosed = await closeNcrViaApi(page, first);
      expect(await listPdfs(page.request, travelerId)).toHaveLength(1);
      const secondClosed = await closeNcrViaApi(page, second);

      const pdfs = await listPdfs(page.request, travelerId);
      expect(pdfs.map(p => p.ncr_number).sort()).toEqual(
        [firstClosed.ncr.ncr_number, secondClosed.ncr.ncr_number].sort()
      );
      await page.goto(`/travelers/${travelerId}/`);
      await expect(page.locator('.ncr-pdf-link')).toHaveCount(2);
      // each report is on its own NCR's row, not the other's
      for (const { ncr } of [firstClosed, secondClosed]) {
        await expect(
          page.locator('.ncr-link-row', {
            hasText: `${ncr.ncr_number} Close report: ${ncr.ncr_number}.pdf`,
          })
        ).toHaveCount(1);
      }
    });

    test('a standalone NCR closes with no traveler attachment at all', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const created = await page.request.post('/api/ncrs', {
        data: ncrRequestBody(id),
      });
      expect(created.status()).toBe(201);
      const ncrId = (await created.json()).ncr.ncr_id;

      const closed = await closeNcrViaApi(page, ncrId);

      expect(closed.closure_pdf).toEqual({ status: 'not_applicable' });
      const ncr = await ncrEvents(ncrId);
      expect(ncr.events.map(e => e.event_type)).not.toContain(
        'traveler.pdf_attached'
      );
      expect(ncr.events.map(e => e.event_type)).not.toContain(
        'traveler.pdf_failed'
      );
      expect(await listPdfs(page.request, travelerId)).toHaveLength(0);
    });

    test('a traveler that is frozen when its NCR closes still gets the PDF', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const ncrId = await createNcrByReference(page, id, travelerId, 'input_a');
      await execFixtureCli('set-traveler-status', { travelerId, status: 3 });

      const closed = await closeNcrViaApi(page, ncrId);

      expect(closed.closure_pdf.status).toBe('attached');
      expect(await listPdfs(page.request, travelerId)).toHaveLength(1);
    });

    test('if the PDF cannot be attached the NCR still closes, and the failure is recorded and reported', async ({
      page,
    }) => {
      const id = runId();
      // linked to a traveler that does not exist, so there is nowhere to attach it
      const { ncrId } = await createLinkedNcr(id, {
        travelerId: '507f1f77bcf86cd799439000',
        inputName: 'input_a',
        inputLabel: 'Input A',
        status: 'Final Approval',
      });

      const res = await page.request.patch(`/api/ncrs/${ncrId}/close`, {
        data: {
          disposition_execution_verified: true,
          traveler_signed_off: true,
        },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.ncr.status).toBe('Closed');
      expect(body.closure_pdf).toEqual({
        status: 'failed',
        message: 'The traveler this NCR was linked to no longer exists.',
      });
      const ncr = await ncrEvents(ncrId);
      expect(ncr.status).toBe('Closed');
      const failed = ncr.events.find(
        e => e.event_type === 'traveler.pdf_failed'
      );
      expect(failed.payload.reason).toBe(
        'The traveler this NCR was linked to no longer exists.'
      );
      // no path or stack in what is recorded
      expect(JSON.stringify(failed)).not.toMatch(/\/app|\.js|at .*\(/);
    });

    test('the close page warns the person closing the NCR when its PDF could not be attached', async ({
      page,
    }) => {
      const id = runId();
      const { ncrId } = await createLinkedNcr(id, {
        travelerId: '507f1f77bcf86cd799439000',
        inputName: 'input_a',
        inputLabel: 'Input A',
        status: 'Final Approval',
      });

      await page.goto(`/ncrs/${ncrId}/close`);
      await page.check('#disposition_execution_verified');
      await page.check('#traveler_signed_off');
      await page.click('#close-btn');

      await expect(page.locator('#close-success')).toBeVisible();
      await expect(page.locator('#close-warning')).toBeVisible();
      await expect(page.locator('#close-warning')).toContainText(
        'could not be attached'
      );
    });

    test('the PDF survives the NCR being deleted by an administrator', async ({
      page,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const ncrId = await createNcrByReference(page, id, travelerId, 'input_a');
      const closed = await closeNcrViaApi(page, ncrId);

      const deleted = await page.request.delete(`/api/ncrs/${ncrId}`);
      expect(deleted.status()).toBe(200);

      const pdfs = await listPdfs(page.request, travelerId);
      expect(pdfs).toHaveLength(1);
      expect(pdfs[0].ncr_number).toBe(closed.ncr.ncr_number);
      const file = await page.request.get(
        `/travelers/${travelerId}/ncr-pdfs/${pdfs[0].pdf_id}`
      );
      expect(file.status()).toBe(200);
      expect((await file.body()).slice(0, 5).toString('latin1')).toBe('%PDF-');

      // and the traveler still shows it, on a row of its own — the NCR is gone,
      // so there is no NCR link on the row
      await page.goto(`/travelers/${travelerId}/`);
      const number = closed.ncr.ncr_number;
      const row = page.locator('.ncr-link-row');
      await expect(row).toHaveCount(1);
      await expect(row).toContainText(`${number} Close report: ${number}.pdf`);
      await expect(row.locator('.ncr-link-badge')).toHaveCount(0);
    });

    test("a PDF cannot be fetched through another traveler's URL", async ({
      page,
    }) => {
      const id = runId();
      const { travelerId: owner } = await createTraveler({
        inputs: fourInputs(id),
      });
      const { travelerId: other } = await createTraveler({
        inputs: fourInputs(id),
      });
      const ncrId = await createNcrByReference(page, id, owner, 'input_a');
      await closeNcrViaApi(page, ncrId);
      const [pdf] = await listPdfs(page.request, owner);

      const through = await page.request.get(
        `/travelers/${other}/ncr-pdfs/${pdf.pdf_id}`
      );
      expect(through.status()).toBe(404);
      // and it is not listed under the other traveler
      expect(await listPdfs(page.request, other)).toHaveLength(0);
      // a malformed id is a plain 404, not a server error
      const malformed = await page.request.get(
        `/travelers/${owner}/ncr-pdfs/not-an-id`
      );
      expect(malformed.status()).toBe(404);
    });
  }
);

test.describe(
  'US3 — the Basic-auth REST API enforces the same submission gate',
  () => {
    // The API (port 3002) authenticates with a write user from the stack's own
    // config, not a session, so it is driven with its own request context.
    async function apiContext(playwright) {
      const { apiBaseUrl } = resolveEnv();
      const password = require('../docker/api.json').api_users.api_write;
      return playwright.request.newContext({
        baseURL: apiBaseUrl,
        extraHTTPHeaders: {
          Authorization: `Basic ${Buffer.from(`api_write:${password}`).toString(
            'base64'
          )}`,
        },
      });
    }

    const update = status => ({
      userName: PRIMARY,
      title: 'REST API gate check',
      description: 'd',
      deadline: '',
      status,
    });

    test('both status routes refuse while an NCR is open — including the direct active-to-completed route — and allow it once the NCR is Closed', async ({
      playwright,
    }) => {
      const id = runId();
      const { travelerId } = await createTraveler({ inputs: fourInputs(id) });
      const ncr = await createLinkedNcr(id, {
        travelerId,
        inputName: 'input_a',
        inputLabel: `Input A ${id}`,
      });
      const api = await apiContext(playwright);

      // PUT /apis/travelers/:id/status/
      let res = await api.put(`/apis/travelers/${travelerId}/status/`, {
        data: { status: 1.5, userId: PRIMARY },
      });
      expect(res.status()).toBe(409);
      expect(await res.json()).toMatchObject({
        success: false,
        code: 'OPEN_NCRS',
      });
      expect((await res.json()).open_ncrs.map(n => n.ncr_number)).toEqual([
        ncr.ncr_number,
      ]);
      expect(await travelerStatus(travelerId)).toBe(1);

      // POST /apis/update/traveler/:id/ — submission, and the helper's direct 1 -> 2
      for (const status of [1.5, 2]) {
        res = await api.post(`/apis/update/traveler/${travelerId}/`, {
          data: update(status),
        });
        expect(res.status()).toBe(409);
        expect((await res.json()).code).toBe('OPEN_NCRS');
        expect(await travelerStatus(travelerId)).toBe(1);
      }

      // a plain update that leaves the status alone is not a submission
      res = await api.post(`/apis/update/traveler/${travelerId}/`, {
        data: update(1),
      });
      expect(res.status()).toBe(200);

      // with the NCR Closed the same request goes through
      await execFixtureCli('set-ncr-status', {
        ncrId: ncr.ncrId,
        status: 'Closed',
      });
      res = await api.put(`/apis/travelers/${travelerId}/status/`, {
        data: { status: 1.5, userId: PRIMARY },
      });
      expect(res.status()).toBe(200);
      expect(await travelerStatus(travelerId)).toBe(1.5);
      await api.dispose();
    });
  }
);
