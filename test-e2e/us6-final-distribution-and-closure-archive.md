# Test E2E — User Story 6: Final NCR Distribution and Closure Archive

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 6 - Final
NCR Distribution and Closure Archive" (Priority: P2)
**Files under test**: `lib/ncr-service.js` (`closeNcr` final-distribution
recipient logic), `views/ncr-dashboard.jade`, `routes/ncr.js` (`GET /api/ncrs`)

This story's closure trigger is the same action tested in
`us5-ncr-issuance-and-execution.md` — reuse that NCR rather than closing a
new one. This test's distinct focus is (a) exactly *who* the final
distribution reaches, and (b) that closed NCRs remain archived/searchable
while excluded from the active view.

## Setup

- Requires NCR-A, already closed by `us5-ncr-issuance-and-execution.md`.
- For the recipient-group check to be meaningful, before closing that NCR
  you should have: a QA Staff identity set (`qa_staff_identity`, from the
  US3 test), at least one additional approver
  (`additional_approvers[]`, from the US3 test — reuse NCR-B1/B2 and close
  one of those instead of NCR-A if NCR-A had no additional approvers), at
  least one preventive action with an owner assigned (from
  `us7-preventive-action-tracking.md` — run that test first, or accept
  that this group will be empty for NCR-A), and a `supplier_name` set (all
  test NCRs have one) to trigger the PPM group.
- If you want every recipient group populated for this test, close NCR-B1
  from `us3-qa-concurrence-and-approver-coordination.md` instead (it has an
  additional approver already); assign a preventive-action owner to it
  first via `us7-preventive-action-tracking.md`'s steps, then close it
  following `us5`'s Part A closure steps.

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

### Acceptance Scenario 1 — final distribution sent to 5 stakeholder groups

1. Navigate to `http://localhost:3001/ncrs/<closed-ncr-id>`.
2. Open the Event Timeline and find the `notification.final_distribution`
   entry. Expand `[payload]` or otherwise inspect its recorded recipients.
3. List every distinct recipient in that event.
4. Compare the list against the spec's required groups: (1)
   Originator/Designee, CE/CS, QA Staff, (2) Preventive Action Owner (if
   identified), (3) Additional Approvers (if designated), (4) Cognizant
   Group Leader and Division Director, (5) PPM/Supply Management (if
   supplier issue).

### Acceptance Scenario 2 — recipients can view the complete closed NCR

5. Navigate to the NCR detail page directly (standing in for "clicking the
   link in the distribution email" — both lead to the same page).
6. Confirm the page shows full history: creation info, disposition,
   approvals, and closure information, all still visible now that the NCR
   is Closed.

### Acceptance Scenario 3 — closed NCR excluded from active/open list

7. Navigate to `http://localhost:3001/ncrs` with default filters (Include
   Closed unchecked). Confirm this NCR does not appear.

### Acceptance Scenario 4 — closed NCR is searchable for historical purposes

8. Check "Include Closed", click "Apply". Confirm the NCR now appears with
   a "Closed" badge and all its data intact.
9. Clear filters, search by this NCR's Part Number specifically (still with
   Include Closed checked). Confirm it's found.

### Acceptance Scenario 5 — closed NCRs remain available for trend/quality reporting

10. With Include Closed checked, apply the "Disposition" filter matching
    this NCR's parts disposition (e.g. "Rework"). Confirm the closed NCR
    still appears in the filtered results — i.e. filtering by disposition
    type works across closed and open NCRs alike, supporting trend
    analysis.


### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `US6-final-distribution-and-closure-archive-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is today's date.
- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/US6-final-distribution-and-closure-archive-<YYYY-MM-DD>-report.md`.

## Expected Results

- **AS1**: read the actual recipient list from step 3 rather than assuming
  it matches the spec. Based on `lib/ncr-service.js`'s `closeNcr` function,
  expect the recipients to cover: Originator, CE/CS, the specific
  `qa_staff_identity` **and** every user with the `qa_staff` role,
  Additional Approvers, Preventive Action Owners, and PPM-role users (only
  if `supplier_name` is set — which it always is for these test NCRs).
  **Expect no "Cognizant Group Leader and Division Director" recipients** —
  `closeNcr`'s recipient-building logic has no lookup for those roles at
  all, unlike the spec's AS1 group (4). This is a real gap, not something
  you missed.
- **AS2–AS5**: all should work as specified — the archive/search behavior
  is straightforward once "Include Closed" is checked, and filters apply
  uniformly regardless of status.

## Human Verification Checklist

- [ ] Read `notification.final_distribution`'s `recipients[]` directly from
      mongo-express and list each `recipient_id`. Cross-reference against
      the NCR's `originator_id`, `ce_cs_id`, `qa_staff_identity`,
      `additional_approvers[].approver_id`, and
      `preventive_actions[].owner_id` fields to confirm each present group
      is actually represented.
- [ ] Confirm there is no recipient in that list corresponding to a "Group
      Leader" or "Division Director" role (there's no such role concept
      anywhere in the `users` collection roles used by this codebase to
      begin with — search the `users` collection for any `roles` values
      resembling this to be sure).
- [ ] Confirm the closed NCR is invisible under default dashboard filters
      but fully visible (all fields, full event timeline) once Include
      Closed is checked.
- [ ] Confirm filtering by Part Number and by Disposition Type both
      correctly include the closed NCR when Include Closed is checked, and
      correctly exclude it when unchecked.
