# Test E2E — User Story 1.6: Request Engineering Disposition

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 1.6 -
Request Engineering Disposition" (Priority: P1)
**Files under test**: `lib/ncr-service.js` (`createNcr`), `lib/ncr-email.js` (`sendDispositionRequest`), `model/ncr.js` (`ce_cs_delegate_id`)

Like User Story 1.5, this has no dedicated page — it's a side effect of NCR
creation, gated on `ce_cs_id` being present. **The standalone NCR creation
page never captures `ce_cs_id`** (only the free-text `ce_cs_name`), so this
story can only be exercised today by creating the NCR via a direct API
call, exactly like the Traveler-linking workaround in earlier sessions of
this test suite.

## Setup

- Logged in to the web app as `<your-username>` (needed so the `fetch()`
  call below carries your session cookie).
- Pick a second username to act as the CE/CS recipient — call it
  `<cecs-username>` (any user document already in the `users` collection;
  it needs no special role, since `submitDisposition`'s permission check is
  per-assignment, not role-based).

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

### Acceptance Scenarios 1 & 2 — CE/CS receives a request with a link to the full NCR

1. Navigate to any authenticated page, e.g. `http://localhost:3001/ncr`.
2. Open DevTools Console and run (substituting `<cecs-username>` and a real
   email):

   ```js
   fetch('/api/ncr', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'same-origin',
     body: JSON.stringify({
       part_name: 'CE/CS Request Test Bracket',
       part_number: 'BA-E2E-CECS',
       part_revision: 'A',
       quantity: 3,
       supplier_name: 'Acme Fabrication',
       wbs_number: 'WBS-E2E-CECS',
       specification_drawing_reference: 'DWG-E2E-CECS',
       description_of_nonconformance: 'CE/CS disposition-request test NCR created via API to set ce_cs_id.',
       discovery_date: new Date().toISOString().slice(0, 10),
       discovery_context: 'in_house_inspection',
       ce_cs_name: 'Doe, Jane',
       ce_cs_id: '<cecs-username>',
       ce_cs_email: 'cecs-test@example.com',
     }),
   }).then(r => r.json()).then(console.log);
   ```
3. Record the returned `ncr.ncr_number` and `ncr.ncr_id`.
4. Navigate to `http://localhost:3001/ncr/<ncr-id>`.
5. Open the Event Timeline and find the `notification.disposition_request`
   entry. Inspect its recorded recipient(s).
6. Confirm the NCR detail page itself (which is what the "link to the
   complete NCR" in the request email would point to) shows all mandatory
   fields, matching Part Name, Number, Revision, Quantity, Supplier, WBS,
   Description.

### Acceptance Scenario 3 — CE/CS assignment recorded with timestamp

7. Confirm the `ncrs` document (mongo-express) has `ce_cs_id` set to
   `<cecs-username>` and `ce_cs_name: "Doe, Jane"` at the top level (this is
   the "assignment" — there is no separate access-log entry beyond the
   `notification.disposition_request` event itself).

### Acceptance Scenarios 4 & 5 — Originator Delegate assignment (expected to fail — not implemented)

8. Attempt to find any UI control (on the NCR detail page, or anywhere else
   in the app) that lets a CE/CS designate an "Originator Delegate" for a
   specific NCR. Report whether one exists.
9. In DevTools Console, attempt a direct write of `ce_cs_delegate_id` via
   the API (there is no dedicated endpoint for this — try the closest
   candidate, the disposition PATCH, to see if it's silently accepted):

   ```js
   fetch('/api/ncr/<ncr-id>/disposition', {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'same-origin',
     body: JSON.stringify({
       parts_disposition: 'Scrap',
       root_cause_documentation: 'x'.repeat(60),
       preventive_actions: ['y'.repeat(60)],
       ce_cs_delegate_id: '<some-other-username>',
     }),
   }).then(r => r.json()).then(console.log);
   ```
   (Run this as `<cecs-username>`, i.e. logged in as the assigned CE/CS, so
   the call at least passes the CE/CS-identity check.)


### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `US1.6-request-engineering-disposition-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is today's date.
- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/US1.6-request-engineering-disposition-<YYYY-MM-DD>-report.md`.

## Expected Results

- **AS1/AS2**: the `notification.disposition_request` event exists with a
  recipient matching `ce_cs_id`/`ce_cs_email`, and the NCR detail page shows
  the complete mandatory data set.
- **AS3**: `ce_cs_id` and `ce_cs_name` are persisted on the NCR document.
- **AS4/AS5**: expect these to **not** work as described in the spec. There
  is no UI for delegate assignment, no dedicated API endpoint, and the
  `delegate.assigned` event type is defined in `model/ncr.js`'s event enum
  but never pushed anywhere in `lib/ncr-service.js`. Step 9's PATCH call
  will likely succeed (200) for the fields it does recognize, but
  `ce_cs_delegate_id` is not part of `submitDisposition`'s accepted `data`
  shape and will be silently ignored rather than stored.

## Human Verification Checklist

- [ ] `ncrs` document: `ce_cs_id` and `ce_cs_name` match what was sent in
      step 2.
- [ ] `events` array contains `notification.disposition_request` with a
      recipient whose `recipient_id`/`recipient_email` matches
      `<cecs-username>` / the email supplied.
- [ ] `notification.initial` is a **separate** event from
      `notification.disposition_request` (confirms US1.5 and US1.6 send
      distinct emails, per spec, even though this test showed the recipient
      lists for each may not fully match the spec's intended audience — see
      `us1.5-send-initial-notification.md`).
- [ ] After step 9, re-fetch the NCR and confirm `ce_cs_delegate_id` is
      **not** set on the document — this confirms the delegate-assignment
      capability described in the spec's AS4/AS5 genuinely doesn't exist
      yet, rather than something you missed in the UI. Flag this as an
      open gap between spec and implementation rather than a test failure
      on your part.
