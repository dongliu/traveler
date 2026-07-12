# Test E2E — User Story 3: QA Concurrence and Approver Coordination

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 3 - QA
Concurrence and Approver Coordination" (Priority: P1)
**Files under test**: `views/ncr-concurrence.jade`, `views/ncr-approval.jade`, `routes/ncr.js` (`PATCH /api/ncrs/:id/concurrence`, `PATCH /api/ncrs/:id/approve`, `PATCH /api/ncrs/:id/resubmit`), `lib/ncr-service.js` (`submitConcurrence`, `submitApproval`, `returnForComment`, `qaResubmit`)

## Setup

- Requires **three** NCRs in `Dispositioned` status (repeat
  `us1`+`us2` three times, or duplicate one in mongo-express and reset
  `status` to `Dispositioned`, clearing `additional_approvers`):
  - **NCR-A**: for Acceptance Scenarios 1–4 (no additional approvers path).
  - **NCR-B1**: for Acceptance Scenarios 5, 6, 8 (approve path).
  - **NCR-B2**: for Acceptance Scenario 7 + the resubmit loop (return for
    comment, then QA resubmit).
- **Required fixture edit**: add `"qa_staff"` to your test user's `roles`
  array (mongo-express), per README "Test fixture setup".
- Pick a second username, `<approver-username>`, to act as the designated
  approver for NCR-B1 and NCR-B2 (any existing user document; no special
  role needed — the approval check is per-assignment, not role-based).

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

### Acceptance Scenarios 1–4 — QA reviews and concurs with no additional approvers (NCR-A)

1. Logged in as the QA Staff test user, navigate to
   `http://localhost:3001/ncrs/<ncr-a-id>/concurrence`.
2. Confirm the page shows "QA Concurrence" as heading, and the NCR Summary
   + Engineering Disposition sections match NCR-A's disposition data (AS1).
3. Confirm the Additional Approvers table shows: "No additional approvers —
   concurring will move NCR directly to Final Approval." — and that you
   *could* add one here if you wanted to (AS2 capability, not exercised on
   this NCR).
4. Click "Concur" without adding any approvers (AS3).
5. Read the resulting success message (AS4).

### Acceptance Scenarios 5, 6, 8 — QA designates an approver; approver approves (NCR-B1)

6. Navigate to `http://localhost:3001/ncrs/<ncr-b1-id>/concurrence`.
7. In the "username" field, enter `<approver-username>`; in the role field,
   enter `Project Manager`. Click "Add". Confirm the row appears (AS2).
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


### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `US3-qa-concurrence-and-approver-coordination-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is today's date.
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
  approver(s)." Status → `Approved`. After Approve, message: "You approved.
  All approvers have approved — NCR moved to Final Approval." Status →
  `Final Approval`.
- **NCR-B2**: after Return for Comment, message "Returned for comment. QA
  Staff has been notified." Status → `Returned for Comment`. After
  Resubmit, message "Resubmitted to approvers. New approval requests
  sent." Status → `Approved` again, with the approver reset to "Pending".
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
      `additional_approvers[0].approval_status: "Approved"`, `events`
      contains `qa.concurred` (new_status "Approved"),
      `approvers.designated`, `notification.approval_request`,
      `approval.approved`, and a second `notification.issuance`.
- [ ] NCR-B2: `status: "Approved"` (after resubmit),
      `additional_approvers[0].approval_status: "Pending"`, `events`
      contains `approval.returned_for_comment` (with the exact comment
      text) and `qa.resubmitted`.
- [ ] Confirm step 21's API call did **not** change NCR status or append a
      `qa.rejected` event — re-fetch the NCR in mongo-express before and
      after the call and diff the document.
- [ ] Flag AS9 (QA rejection back to CE/CS) as not implemented in your test
      report, rather than assuming you missed a button.
