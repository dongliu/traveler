# Test E2E — User Story 3: QA Concurrence and Approver Coordination

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 3 - QA
Concurrence and Approver Coordination" (Priority: P1)
**Files under test**: `views/ncr-concurrence.jade`, `views/ncr-approval.jade`, `views/ncr-detail.jade`, `routes/ncr.js` (`PATCH /api/ncrs/:id/concurrence`, `PATCH /api/ncrs/:id/approve`, `PATCH /api/ncrs/:id/resubmit`, `POST /api/ncrs/:id/approvers`, `DELETE /api/ncrs/:id/approvers/:approverId`), `lib/ncr-service.js` (`submitConcurrence`, `submitApproval`, `returnForComment`, `qaResubmit`, `addApprover`, `removeApprover`)

## Setup

- Requires **five** NCRs in `Dispositioned` status (repeat
  `us1`+`us2` five times, or duplicate one in mongo-express and reset
  `status` to `Dispositioned`, clearing `additional_approvers`):
  - **NCR-A**: for Acceptance Scenarios 1–4 (no additional approvers path).
  - **NCR-B1**: for Acceptance Scenarios 5, 6, 8 (approve path).
  - **NCR-B2**: for Acceptance Scenario 7 + the resubmit loop (return for
    comment, then QA resubmit).
  - **NCR-C**: for the Manage Approvers section (add/remove approvers
    before issuance).
  - **NCR-D**: for the Manage Approvers section while status is
    `Returned for Comment`.
- A *third* username, `<second-approver-username>`, distinct from
  `<approver-username>`, is needed for the Manage Approvers section.
- **Required fixture edits**:
  - Add `"qa_staff"` to your test user's `roles` array (mongo-express), per
    README "Test fixture setup".
  - Add your test user to the `ncr-qa` group document in mongo-express
    (collection `groups`, `_id: "ncr-qa"`, push user id into `members`).
    `submitConcurrence` calls `isQaStaffMember` which checks this group; if
    the user is absent the request returns 403.
- Use `wbs_number: 1.2.3` on every test NCR — this entry is pre-registered
  in `docker/wbs.yaml` so all notification paths (issuance, approval request)
  resolve a contact correctly.
- Pick a second username, `<approver-username>`, to act as the designated
  approver for NCR-B1 and NCR-B2 (any existing user document; no special
  role needed — the approval check is per-assignment, not role-based).

## Test Steps for Claude in Chrome

### Session Setup — Environment

0. Read the project's `.env` file (at the repo root, relative to this
   file: `../.env`; gitignored; falls back to
   the defaults below for any var that is unset) to resolve the actual
   ports for this run: `WEB_PORT` (default `3001`), `API_PORT` (default
   `3002`), `MONGO_EXPRESS_PORT` (default `8081`), and the app login
   credentials `E2E_USER` and `E2E_PASS`. Mongo Express basic-auth
   credentials are `traveler` / `travelerpass` (defined in
   `docker-compose.yml`, not in `.env`). Use the resolved web app port for
   every `localhost:3001`-style URL referenced below in this file —
   substitute the real port, don't assume the placeholder.
0. Navigate to `http://localhost:<WEB_PORT>/login`. If the page redirects to
   the app (already authenticated), skip to the next step. Otherwise, enter
   the value of `E2E_USER` as the username and `E2E_PASS` as the password and
   submit the login form.

### Acceptance Scenarios 1–4 — QA reviews and concurs with no additional approvers (NCR-A)

1. Logged in as the QA Staff test user, navigate to
   `http://localhost:3001/ncrs/<ncr-a-id>/concurrence`.
2. Confirm the page shows "QA Concurrence" as heading, and the NCR Summary
   + Engineering Disposition sections match NCR-A's disposition data (AS1).
3. Confirm the Additional Approvers table has an **"Approver"** column only —
   there is no "Role" column and no role input field anywhere on the page.
   Confirm the table shows: "No additional approvers —
   concurring will move NCR directly to Final Approval." — and that you
   *could* add one here if you wanted to (AS2 capability, not exercised on
   this NCR).
4. Click "Concur" without adding any approvers (AS3).
5. Read the resulting success message (AS4).

### Acceptance Scenarios 5, 6, 8 — QA designates an approver; approver approves (NCR-B1)

6. Navigate to `http://localhost:3001/ncrs/<ncr-b1-id>/concurrence`.
7. In the add-approver field (typeahead-enabled against the AD username
   cache, placeholder "Last, First"), start typing `<approver-username>`'s
   display name. Confirm a suggestion dropdown appears. Either select the
   suggestion or type the full display name and click "Add". Confirm the
   row appears with the approver's **display name** (not their raw
   username) — no role column or role value is shown (AS2).
8. Click "Concur" (AS5).
9. Read the resulting success message.
10. Log out, log back in as `<approver-username>`.
11. Navigate to `http://localhost:3001/ncrs/<ncr-b1-id>/approve`. Confirm the
    page shows the complete nonconformance, CE/CS disposition, and QA
    concurrence info, with "Approve" and "Return for Comment" controls
    (AS6).
12. Click "Approve" (AS8, since this is the only designated approver — all
    approvers approving transitions the NCR).
13. Read the resulting success message.

### Acceptance Scenario 7 — approver returns for comment, QA resubmits (NCR-B2)

14. Repeat steps 6–7 against NCR-B2 (designate `<approver-username>`, click
    "Concur").
15. Log in as `<approver-username>`, navigate to
    `http://localhost:3001/ncrs/<ncr-b2-id>/approve`.
16. In "Return Comments", enter: `Rework instructions are unclear about the sanding grit — please clarify with CE/CS before I can approve.`
17. Click "Return for Comment" (AS7).
18. Log back in as QA Staff, navigate to
    `http://localhost:3001/ncrs/<ncr-b2-id>/approve` again. Confirm a "QA
    Action" section with a "Resubmit to Approvers" button is now visible,
    and the approver table shows the returned status + comment.
19. Click "Resubmit to Approvers".

### Acceptance Scenario 9 — QA rejects disposition back to CE/CS (expected: not implemented)

20. On any Dispositioned NCR's concurrence page, look for a "Reject" button
    or any control that would send the NCR back to CE/CS with feedback.
    Report whether one exists.
21. In DevTools Console, check whether the concurrence endpoint accepts a
    rejection action:

    ```js
    fetch('/api/ncrs/<a-dispositioned-ncr-id>/concurrence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'reject', comments: 'Needs more detail' }),
    }).then(r => r.json()).then(console.log);
    ```


### Manage Approvers — QA adds/removes approvers before issuance (requires a fourth NCR, NCR-C)

Requires a fourth NCR, **NCR-C**, dispositioned like the others, plus a
*third* username, `<second-approver-username>`, distinct from
`<approver-username>`.

22. As QA Staff, navigate to `http://localhost:3001/ncrs/<ncr-c-id>/concurrence`
    and designate `<approver-username>` only, then click "Concur". NCR-C is
    now `Approval Requested` with one Pending approver.
23. Navigate to `http://localhost:3001/ncrs/<ncr-c-id>/approve`. Confirm a
    **"Manage Approvers"** fieldset is visible below "Approver Status",
    with a typeahead-enabled add field and an "Add Approver" button, and
    confirm the existing approver's row has a **"Remove"** button. Then
    navigate to `http://localhost:3001/ncrs/<ncr-c-id>` (the main NCR
    detail page, not `/approve`) and confirm the **identical**
    "Approval Status" table with "Manage Approvers" fieldset appears
    there too — QA can manage approvers from either page.
24. In the Manage Approvers field, type `<second-approver-username>`'s
    display name and click "Add Approver". Confirm the page reloads and a
    second row appears in Approver Status with status "Pending" — NCR-C
    status remains `Approval Requested`.
25. Click "Remove" on `<second-approver-username>`'s row; accept the
    confirmation dialog. Confirm the page reloads, that row is gone, and
    NCR-C status remains `Approval Requested` (one Pending approver — `<approver-username>` —
    remains).
26. Click "Remove" on the one remaining approver's row; accept the
    confirmation dialog. Confirm the page reloads, the Approver Status
    table is now empty, the **"Manage Approvers" fieldset is gone**
    (NCR-C is no longer `Approval Requested`), and the NCR status badge now reads
    `Final Approval`.
27. Log out, log back in as `<approver-username>` (not QA staff). Create or
    reuse a Dispositioned NCR, designate them as the sole approver, and
    concur. Navigate to that NCR's `/approve` page logged in as
    `<approver-username>`. Confirm **no** "Manage Approvers" fieldset and
    **no** "Remove" buttons are visible to them.
28. In DevTools Console (still logged in as `<approver-username>`), confirm
    the backend also rejects the action, not just the UI:

    ```js
    fetch('/api/ncrs/<any-approved-ncr-id>/approvers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ approver_id: 'someone' }),
    }).then(r => r.json()).then(console.log);
    ```

### Manage Approvers while Returned for Comment (requires a fifth NCR, NCR-D)

Requires a fifth NCR, **NCR-D**, dispositioned like the others. Designate
**both** `<approver-username>` and `<second-approver-username>` at
concurrence and click "Concur" — NCR-D is now `Approval Requested` with two Pending
approvers.

29. Log in as `<approver-username>`, navigate to
    `http://localhost:3001/ncrs/<ncr-d-id>/approve`, enter any comment, and
    click "Return for Comment". NCR-D status is now `Returned for Comment`.
30. Log back in as QA Staff, navigate to the same `/approve` page. Confirm
    the **"Manage Approvers"** fieldset is still visible (it is no longer
    restricted to `Approval Requested` status), and both approver rows — including
    `<approver-username>`'s row showing status "Returned for Comment" —
    have a "Remove" button.
31. Click "Remove" on `<approver-username>`'s row (the one that returned
    for comment); accept the confirmation dialog. Confirm the page
    reloads and the NCR status badge now reads `Approval Requested` again (not
    still `Returned for Comment`, and not stuck) — `<second-approver-username>`'s
    Pending entry is the only one left.

### End of Session — Save Artifacts, Report

After the final test step above:

- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/US3-qa-concurrence-and-approver-coordination-<YYYY-MM-DD>-report.md`.

## Expected Results

- **NCR-A**: success message "NCR moved to Final Approval; issuance email
  sent." Status `Dispositioned` → `Final Approval` directly.
- **NCR-B1**: after Concur, success message "Approval requests sent to 1
  approver(s)." Status → `Approval Requested`. After Approve, message: "You approved.
  All approvers have approved — NCR moved to Final Approval." Status →
  `Final Approval`.
- **NCR-B2**: after Return for Comment, message "Returned for comment. QA
  Staff has been notified." Status → `Returned for Comment`. After
  Resubmit, message "Resubmitted to approvers. New approval requests
  sent." Status → `Approval Requested` again, with the approver reset to "Pending".
- **NCR-C**: after step 24, `additional_approvers` has 2 entries, status
  `Approval Requested`. After step 25, back to 1 entry, still `Approval Requested`. After step
  26 (removing the last Pending approver), status → `Final Approval` and
  an issuance email is sent — removing the last blocking approver behaves
  the same as that approver clicking Approve themselves.
- **NCR-D**: after step 29, status `Returned for Comment` with
  `<approver-username>`'s entry showing that status and the comment text.
  After step 31 (removing that specific blocking entry), status →
  `Approval Requested` (not stuck, and not skipped ahead to `Final Approval` since
  `<second-approver-username>` is still `Pending`) — the NCR resumes
  normal waiting instead of staying blocked on a decision that can no
  longer arrive.
- **AS9**: expect **no** Reject control anywhere in the UI, and the
  `PATCH .../concurrence` endpoint to either ignore the unrecognized
  `action`/`comments` fields entirely or return a generic success without
  performing any rejection — `lib/ncr-service.js`'s `submitConcurrence`
  function has no branch for rejection, and no route exists for it despite
  `qa.rejected` being a defined event type in `model/ncr.js`'s enum. This is
  a spec/implementation gap, not something to keep searching for.

## Human Verification Checklist

- [ ] NCR-A: `status: "Final Approval"`, `qa_staff_identity` set,
      `events` contains `qa.concurred` (new_status "Final Approval") and
      `notification.issuance`.
- [ ] NCR-B1: `status: "Final Approval"`,
      `additional_approvers[0].approval_status: "Approved"`,
      `additional_approvers[0].approver_role` is **absent** (field no longer
      stored), `events` contains `qa.concurred` (new_status "Approval Requested"),
      `approvers.designated`, `notification.approval_request`,
      `approval.approved`, and a second `notification.issuance`.
- [ ] NCR-B2: `status: "Approval Requested"` (after resubmit),
      `additional_approvers[0].approval_status: "Pending"`, `events`
      contains `approval.returned_for_comment` (with the exact comment
      text) and `qa.resubmitted`.
- [ ] Confirm step 21's API call did **not** change NCR status or append a
      `qa.rejected` event — re-fetch the NCR in mongo-express before and
      after the call and diff the document.
- [ ] Flag AS9 (QA rejection back to CE/CS) as not implemented in your test
      report, rather than assuming you missed a button.
- [ ] Confirm the Additional Approvers table has no "Role" column header and
      no role input field in the add-approver row anywhere in the session.
- [ ] NCR-C: `events` contains `approver.added` (step 24), `approver.removed`
      (steps 25 and 26), and a `notification.issuance` after step 26.
      `additional_approvers` is an empty array after step 26, and `status`
      is `Final Approval`.
- [ ] Confirm step 28's API call returns 403 and does not append an
      `approver.added` event to that NCR.
- [ ] NCR-D: `events` contains `approval.returned_for_comment` (step 29)
      and `approver.removed` (step 31), `status` is `Approval Requested` after step
      31, and `additional_approvers` has exactly one entry
      (`<second-approver-username>`, `approval_status: "Pending"`).
