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

### Part A — 403 Forbidden: QA-only action attempted by a non-QA user

1. Navigate to any authenticated page, e.g. `http://localhost:3001/ncr`.
2. Open DevTools Console and run:

   ```js
   fetch('/api/ncr/<dispositioned-ncr-id>/concurrence', {
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
   fetch('/api/ncr/<submitted-ncr-id>/disposition', {
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
   fetch('/api/ncr/000000000000000000000000').then(r => r.status).then(console.log);
   ```

### Part D — 400 Validation error on creation

6. Run:

   ```js
   fetch('/api/ncr', {
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
   fetch('/api/ncr/<already-dispositioned-ncr-id>/disposition', {
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
