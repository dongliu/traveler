# Quickstart: Traveler-Driven NCR Input Flow and Live Status

How to run and check this feature. Implementation steps are in `tasks.md`.

## Prerequisites

- Docker stack up: `docker compose up` (web on 3001, API on 3002).
- `.env` has `E2E_USER`, `E2E_PASS`, `E2E_USER2`, `E2E_PASS2` (see `.env.example`).
- First time only: `npx playwright install chromium`.
- Unit tests outside Docker need `TRAVELER_CONFIG_REL_PATH=docker`.

## 1. Unit tests (server rules)

```bash
npm run unit
npx mocha test-unit/lib/traveler-ncr.test.js
```

Expected: the new cases for `assertInputsComplete`, `assertSubmittable` (both
codes, and both together), `missingInputs` (empty string, empty array, and a
checkbox set with nothing ticked all count as missing), and `buildLiveStatus`
(no values in the payload; `revision` changes when a value is saved) pass.

## 2. Manual walk-through (one browser, one active traveler)

1. Open an active traveler that has at least a text, a number, a checkbox set,
   and a file input.
   - Expect: every input shows **Input** and **Initiate NCR**; no input is
     editable; no **Copy NCR reference** control anywhere.
2. Click **Input** on the text input.
   - Expect: **Initiate NCR** disappears for that input only; the field is
     editable; Save and Reset appear; other inputs' options are not usable.
3. Save a value.
   - Expect: the input returns to showing both options with the new value; the
     finished count goes up by one.
4. Click **Initiate NCR** on the number input, in a new tab.
   - Expect: the NCR form opens with a read-only line naming the traveler and
     the input; there is no editable "Traveler Input" field.
5. Create the NCR and return to the traveler tab. Wait up to 30 seconds.
   - Expect: the number input now shows its NCR badge and no **Input** option;
     the finished count does not include it; **Submit for completion** is
     disabled and lists the open NCR and any inputs with no value.
6. Close the NCR (in a third tab). Wait up to 30 seconds.
   - Expect: **Input** returns on the number input once the NCR is Closed; a
     close report link appears on the input.
7. Fill the remaining empty inputs.
   - Expect: **Submit for completion** becomes enabled within 30 seconds of the
     last change; clicking it moves the traveler to submitted.

## 3. Refusal checks (REST API)

Use Basic auth against port 3002. Replace `$T` with an active traveler id that has
an empty input and no NCRs.

```bash
curl -s -u "$API_USER:$API_PASS" -X PUT \
  "http://localhost:3002/apis/travelers/$T/status/" \
  -H 'Content-Type: application/json' -d '{"status":1.5,"userId":"..."}'
```

Expected: `409`, `code: "INPUTS_MISSING"`, `missing_inputs` lists the empty
input(s), `open_ncrs: []`. After filling the inputs, the same call succeeds.

## 4. NCR page refresh

1. Open an NCR in one browser. In another, record a disposition.
2. In the first browser, do not reload.
   - Expect: within 30 seconds the status and history update.
3. Start typing a comment on the first page, then repeat step 1 with another
   change.
   - Expect: the typed text is still there when the refresh runs; the body
     updates after the comment is saved or the typing stops being pending.

## 5. End-to-end suite

```bash
npm run e2e -- e2e/us-traveler-input-flow.spec.js
npm run e2e -- e2e/us-traveler-ncr-gating.spec.js
npm run e2e -- e2e/us-traveler-ncr-input-linking.spec.js
```

The first is new (Input/Initiate choice, open-NCR hold, submit gate, 30-second
refresh on both pages). The other two are updated: reference-path and
copy-control scenarios are retired, and "Initiate NCR" scenarios no longer require
a value first.

## Acceptance

Feature is done when: unit tests pass; the e2e files above pass; the walk-through
in section 2 matches its expectations; and `npx eslint .` reports no new errors.
