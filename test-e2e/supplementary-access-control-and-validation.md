# Test E2E — Supplementary: Access Control and Validation

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "Requirements" →
"Security and Access Control" and "Data Management" sections (FR-057
through FR-065). These are cross-cutting functional requirements, not tied
to a single numbered user story, so this test doesn't map 1:1 onto one —
it exists alongside the nine user-story test files (`us1` through `us7`)
rather than in place of one of them.

**Files under test**: `lib/ncr-service.js` (role/status guards), `routes/ncr.js` (`mapServiceError`)

The UI already prevents most invalid actions by simply not rendering the
button (e.g. a non-QA user never sees "Concur"). This test proves the
protection is enforced **server-side**, not just hidden client-side, by
calling the API directly from the browser DevTools console while
authenticated as a user who should be rejected. This is still a "Claude in
Chrome" test — no separate HTTP client is used, only the browser's own
console with its live session cookie.

## Setup

- Logged in to the web app as a user **without** the `qa_staff` role and
  **not** the originator/CE/CS/approver of the target NCR (any freshly
  logged-in low-privilege session works, since NCR-role checks are
  per-assignment, not a general "ncr_user" role).
- Have on hand: the id of an NCR in `Dispositioned` status (from
  `us2-ce-cs-disposition.md`) and one in `Submitted` status (from
  `us1-create-and-submit-ncr.md`), and a random/nonexistent ObjectId (e.g.
  `000000000000000000000000`) for the not-found cases.

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

### Part A — 403 Forbidden: QA-only action attempted by a non-QA user

1. Navigate to any authenticated page, e.g. `http://localhost:3001/ncrs`.
2. Open DevTools Console and run:

   ```js
   fetch('/api/ncrs/<dispositioned-ncr-id>/concurrence', {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'same-origin',
     body: JSON.stringify({ additional_approvers: [] }),
   }).then(r => r.status).then(console.log);
   ```
3. Read the logged HTTP status code and re-run with
   `.then(r => r.json())` in place of `.then(r => r.status)` to see the
   response body.

### Part B — 403 Forbidden: disposition attempted by the wrong CE/CS

4. Run, against the `Submitted`-status NCR from
   `us1-create-and-submit-ncr.md` (which has no `ce_cs_id` set, or one set
   to a different username than the currently logged-in user):

   ```js
   fetch('/api/ncrs/<submitted-ncr-id>/disposition', {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'same-origin',
     body: JSON.stringify({
       parts_disposition: 'Scrap',
       root_cause_documentation: 'x'.repeat(60),
       preventive_actions: ['y'.repeat(60)],
     }),
   }).then(r => r.json()).then(console.log);
   ```

### Part C — 404 Not Found

5. Run:

   ```js
   fetch('/api/ncrs/000000000000000000000000').then(r => r.status).then(console.log);
   ```

### Part D — 400 Validation error on creation

6. Run:

   ```js
   fetch('/api/ncrs', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'same-origin',
     body: JSON.stringify({ part_name: 'Incomplete NCR' }),
   }).then(r => r.json()).then(console.log);
   ```

### Part E — 409 Conflict: disposition on an already-Dispositioned NCR

7. Run, against the **same** NCR used in `us2-ce-cs-disposition.md`
   (already Dispositioned), logged in as the CE/CS user from that test:

   ```js
   fetch('/api/ncrs/<already-dispositioned-ncr-id>/disposition', {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'same-origin',
     body: JSON.stringify({
       parts_disposition: 'Scrap',
       root_cause_documentation: 'x'.repeat(60),
       preventive_actions: ['y'.repeat(60)],
     }),
   }).then(r => r.json()).then(console.log);
   ```


### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `SUPP-access-control-and-validation-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is today's date.
- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/SUPP-access-control-and-validation-<YYYY-MM-DD>-report.md`.

## Expected Results

- **Part A**: HTTP `403`. Response body:
  `{"success": false, "error": "Forbidden", "message": "Only QA Staff can provide concurrence"}`
- **Part B**: HTTP `403`. Response body message:
  `"Only assigned CE/CS or Originator Delegate can submit disposition for this NCR"`
- **Part C**: HTTP `404`.
- **Part D**: HTTP `400`. Response body has `error: "Validation Error"` and
  a `details` object listing every missing required field **except**
  `part_name` (which was supplied): `part_number`, `part_revision`,
  `quantity`, `supplier_name`, `wbs_number`, `ce_cs_name`,
  `specification_drawing_reference`, `description_of_nonconformance`,
  `discovery_date`, `discovery_context` — 10 entries.
- **Part E**: HTTP `409`. Response body message:
  `"NCR must be in 'Submitted' status to submit disposition. Current status: Dispositioned"`

## Human Verification Checklist

- [ ] All five requests returned exactly the status codes listed above —
      not `500` (which would indicate an unhandled error rather than a
      deliberate guard).
- [ ] None of the four target NCRs were modified by these calls — reload
      each in mongo-express and confirm `status`, `disposition`, and
      `additional_approvers` are unchanged from before this test ran.
- [ ] Part D's error `details` object has one entry per missing field —
      count them and cross-check against the 10 required fields listed
      above (everything except `part_name`, which was supplied).
- [ ] Re-run Part A logged in as the actual QA Staff test user (from
      `us3-qa-concurrence-and-approver-coordination.md`) against a
      **different** Dispositioned NCR, to positively confirm the same call
      succeeds (200) for an authorized user — this validates the 403 in
      Part A was really about role, not a broken endpoint.
