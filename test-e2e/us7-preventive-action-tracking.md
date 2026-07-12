# Test E2E — User Story 7: Preventive Action Tracking and Management

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 7 -
Preventive Action Tracking and Management" (Priority: P2)
**Files under test**: `views/ncr-detail.jade` (PA widgets), `routes/ncr.js` (`PATCH /api/ncr/:id/preventive-actions/:pa_id/owner`, `.../status`), `lib/ncr-service.js` (`assignPaOwner`, `updatePaStatus`, `closePa`)

## Setup

- Requires an NCR in `Dispositioned` (or later, but not yet Closed) status
  with at least one preventive action — the NCR from
  `us2-ce-cs-disposition.md` has two.
- **QA Staff role** required to assign/close a PA — same test user as
  `us3-qa-concurrence-and-approver-coordination.md`.
- To act as the PA **owner** in the status-update step, assign yourself
  (`<your-username>`) as the owner, so the same logged-in session can both
  assign and later update status.

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

### Acceptance Scenario 1 — captured preventive actions are displayed

1. Navigate to `http://localhost:3001/ncr/<ncr-id>` (logged in as the QA
   Staff test user). Scroll to "Preventive Actions". Confirm both actions
   from disposition are listed with their descriptions, each with status
   badge "Open" and "Unassigned" for owner.

### Acceptance Scenario 2 — QA designates an owner

2. Click "Assign Owner" on the first preventive action.
3. Confirm an inline form appears with: Owner Username, Owner Name, Owner
   Email, Target Completion Date.
4. Fill: Owner Username = `<your-username>`, Owner Name = your display
   name, Owner Email = your email, Target Completion Date = 14 days from
   today.
5. Click "Save".
6. Confirm the page reloads and the action now shows the owner name and
   target date instead of "Unassigned".

### Acceptance Scenario 3 — owner is notified of the assignment

7. Open the Event Timeline and confirm a `pa.owner_assigned` entry exists,
   immediately followed by a `notification.pa_assigned` entry. Inspect the
   latter's recipient — it should match the owner you just assigned.

### Acceptance Scenario 4 — owner updates status, system tracks it

8. Confirm an "Update Status" button now appears on that action (visible
   because `owner_id` matches your session).
9. Click "Update Status". Confirm a form appears with a "New Status"
   dropdown (Open, In Progress, Overdue, Completed) and an optional
   Comment textarea.
10. Select "In Progress", enter comment:
    `Updated work instruction draft is under review.`, click "Save".
11. Confirm the page reloads, the status badge reads "In Progress", and the
    comment appears in a Comments list under that action.

### Acceptance Scenario 5 — completion and closure

12. Update status again, this time selecting "Completed", and click "Save".
13. Before proceeding, check whether anything on the page (or in your
    session, e.g. a notification indicator) informs the QA Staff user that
    this action was just marked complete.
14. As QA Staff, click "Close PA" on the same action. Accept the native
    browser confirmation dialog ("Close this preventive action?").
15. Confirm the badge now reads "Completed" (it may have already, from step
    12) with a completion date, and the action buttons no longer appear.


### End of Session — Stop Recording, Save Artifacts, Report

After the final test step above:

- Stop the GIF recording.
- Save the GIF to `test-e2e/results/`
  (create this directory first if it doesn't exist) as
  `US7-preventive-action-tracking-<YYYY-MM-DD>.gif`, where `<YYYY-MM-DD>` is today's date.
- Output a single markdown block containing:
  - Test ID and timestamp
  - Environment URL (the resolved URL from the Session Setup step above)
  - Step results (pass/fail per numbered step or Acceptance Scenario)
  - Console errors observed during the session
  - Failed network requests observed during the session
  - Overall result (Pass / Fail / Pass with caveats)

  Also save that same markdown block to
  `test-e2e/results/US7-preventive-action-tracking-<YYYY-MM-DD>-report.md`.

## Expected Results

- AS1–AS4 should all work as specified.
- **AS5's "QA Staff receives completion notification" does not happen**:
  `updatePaStatus` in `lib/ncr-service.js` records the status change and
  pushes a `pa.status_updated` event, but never sends an email or creates
  any notification event when the new status is `Completed`. QA Staff must
  notice the status change themselves (e.g. by revisiting the NCR) and
  manually click "Close PA" — there is no automated prompt. Confirm this by
  checking step 13 finds nothing, rather than assuming a notification
  mechanism exists elsewhere.
- Closing the PA (step 14–15) does work as specified — it records
  `pa.closed`, sets `status: "Completed"` and `actual_completion_date`.

## Human Verification Checklist

- [ ] `preventive_actions[0]`: `owner_id`, `owner_name`, `owner_email`,
      `target_completion_date` match step 4's input.
- [ ] `preventive_actions[0].status_history` has two entries:
      `Open`→`In Progress` and `In Progress`→`Completed`, both with
      `changed_by` equal to your username.
- [ ] `preventive_actions[0].comments` includes the exact text from step
      10.
- [ ] `events` array contains, in order: `pa.owner_assigned`,
      `notification.pa_assigned`, `pa.status_updated` (×2, one per status
      change), `pa.closed`. Confirm there is **no** notification-type event
      generated purely from the owner's step-12 "Completed" status update
      (only `pa.closed` — triggered by QA's explicit action in step 14 —
      should be the closure-related event).
- [ ] The second preventive action (untouched) is still `status: "Open"`
      with no owner.
