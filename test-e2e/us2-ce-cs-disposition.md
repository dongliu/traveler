# Test E2E — User Story 2: CE/CS Performs Engineering Disposition

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 2 - CE/CS
Performs Engineering Disposition" (Priority: P1)
**Files under test**: `views/ncr-disposition.jade`, `routes/ncr.js` (`PATCH /api/ncr/:id/disposition`), `lib/ncr-service.js` (`submitDisposition`)

## Setup

- Requires an NCR in `Submitted` status with `ce_cs_id` set to your login
  username. The cleanest source is the NCR created in
  `us1.6-request-engineering-disposition.md` (already has `ce_cs_id` set via
  the API). If you don't have that, take the NCR from
  `us1-create-and-submit-ncr.md` and, in mongo-express, add
  `ce_cs_id: "<your-username>"` to its document (the standalone creation
  page never sets this field — see that test's checklist).
- Logged in as the user matching that NCR's `ce_cs_id`.

## Test Steps for Claude in Chrome

### Session Setup — Environment and Recording

0. Read the project's `.env` file (at the repo root, relative to this
   file: `../.env`; gitignored; falls back to
   the defaults below for any var that is unset) to resolve the actual
   ports for this run: `WEB_PORT` (default `3001`), `API_PORT` (default
   `3002`), `MONGO_EXPRESS_PORT` (default `8081`), and the login credentials
   `E2E_USER` and `E2E_PASS`. Use the resolved web app port for every
   `localhost:3001`-style URL referenced below in this file — substitute the
   real port, don't assume the placeholder.
0. Navigate to `http://localhost:<WEB_PORT>/login`. If the page redirects to
   the app (already authenticated), skip to the next step. Otherwise, enter
   the value of `E2E_USER` as the username and `E2E_PASS` as the password and
   submit the login form.
0. Begin a GIF recording of the browser session before proceeding to the
   first numbered test step below.

### Acceptance Scenario 1 — CE/CS sees all mandatory NCR data

1. Navigate to `http://localhost:3001/ncr/<ncr-id>` and click "Submit
   Disposition" (or navigate directly to
   `http://localhost:3001/ncr/<ncr-id>/disposition`).
2. Confirm the page title reads "Submit Engineering Disposition" and the
   summary box shows the correct Supplier, WBS, Discovery Date, Context,
   and Description.

### Acceptance Scenario 2 — disposition form has all mandatory fields

3. Confirm the form shows: Parts Disposition (radio options Rework,
   Repair, Return to Vendor, Scrap, Use-As-Is), a Root Cause Documentation
   textarea, and a Preventive Actions section with an "Add Another Action"
   button.

### Acceptance Scenario 3 — Rework/Repair requires detailed instructions

4. Select "Rework". Confirm a "Rework / Repair Instructions" textarea
   appears.
5. Fill Root Cause Documentation and one Preventive Action (each ≥ 50
   characters — see exact text below), but leave Rework/Repair Instructions
   **empty**, then click "Submit Disposition".
6. Read the validation error.

### Acceptance Scenarios 4 & 5 — full submission records disposition; incomplete submission is blocked

7. Now fill in Rework/Repair Instructions too:
   - Root Cause Documentation: `Root cause traced to inconsistent clamping pressure during the forming operation, producing localized stress concentration at the bracket edge.`
   - Rework / Repair Instructions: `Rework by lightly sanding the affected edge with 400-grit paper, re-inspect under 10x magnification, and re-verify dimensional tolerance per DWG-E2E-100.`
   - Preventive Action 1: `Update the forming work instruction to specify clamping pressure tolerance and add an in-process check.`
8. Click "Add Another Action" and enter Action 2:
   `Retrain forming operators on the updated clamping procedure and document completion in the training log.`
9. Click "Submit Disposition".
10. Read the success message, then click "View NCR".
11. Confirm the NCR detail page's status badge changed to "Dispositioned"
    and a "Disposition" section shows the parts disposition, root cause,
    and rework/repair instructions exactly as entered, plus both
    preventive actions each with status "Open".


### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `US2-ce-cs-disposition-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is today's date.
- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/US2-ce-cs-disposition-<YYYY-MM-DD>-report.md`.

## Expected Results

- Step 6: validation error reads "Rework/Repair Instructions must be at
  least 50 characters." — submission is blocked, NCR remains `Submitted`.
- Step 9: success banner reads "Disposition submitted. QA Staff have been
  notified for concurrence review."
- Status transitions `Submitted` → `Dispositioned`.
- The Event Timeline gains `disposition.submitted` and
  `notification.qa_notification` entries.

## Human Verification Checklist

- [ ] `ncrs` document `status` is `"Dispositioned"`.
- [ ] `disposition.parts_disposition` is `"Rework"`,
      `disposition.rework_repair_instructions` and
      `disposition.root_cause_documentation` match the entered text,
      `disposition.ce_cs_identity` equals your username.
- [ ] `preventive_actions` array has exactly 2 entries, both `status:
      "Open"`, with the exact `action_description` text entered.
- [ ] `events` array contains `disposition.submitted` (actor = your
      username) and `notification.qa_notification`.
- [ ] Re-attempt step 9 a second time against the same (now Dispositioned)
      NCR via the browser console (`PATCH /api/ncr/<id>/disposition` with
      the same payload) and confirm it now fails — see
      `supplementary-access-control-and-validation.md` Part E for the exact
      409 response this should produce, proving the one-time-only
      constraint (FR-023) is enforced server-side, not just hidden in the
      UI once the button disappears.
