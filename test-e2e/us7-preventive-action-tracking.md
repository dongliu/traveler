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
