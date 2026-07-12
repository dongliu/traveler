# Test E2E — User Story 1.5: Send Initial Notification

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 1.5 - Send
Initial Notification" (Priority: P1)
**Files under test**: `lib/ncr-service.js` (`createNcr`), `lib/ncr-email.js` (`sendInitialNotification`)

This story has no dedicated page — it is a side effect of NCR creation
(User Story 1). Since this dev environment likely has no real SMTP inbox to
check, verification is done through the NCR's recorded `events[]` entry for
the notification (delivery status per recipient) rather than an actual
received email.

## Setup

- Create a fresh NCR via `http://localhost:3001/ncr/new` (same steps as
  `us1-create-and-submit-ncr.md` Acceptance Scenario 2), or reuse that NCR
  if you haven't yet run the disposition test against it.
- No special role required to create the NCR (any authenticated user).
- **Recommended**: before creating the NCR, in mongo-express confirm what
  users (if any) exist in the `users` collection with
  `roles` containing something you'd expect to represent "QA Staff",
  "Group Leader", or "Division Director" — the spec's acceptance criteria
  (below) require the notification go to those roles specifically, so note
  whether any such users exist in your test data before you start.

## Test Steps for Claude in Chrome

### Acceptance Scenario 1 — initial notification sent to QA/Group Leader/Division Director

1. Create the NCR as described in Setup, recording its id.
2. Navigate to `http://localhost:3001/ncr/<ncr-id>`.
3. Open the Event Timeline and find the entry with event type
   `notification.initial`.
4. Click `[payload]` if present, or otherwise inspect the entry's recorded
   recipients.
5. List every recipient shown in that event (recipient id / email / delivery
   status).

### Acceptance Scenario 3 — notification status confirmation is visible in the system

6. Confirm the `notification.initial` event has a timestamp and, for each
   listed recipient, a delivery status field (e.g. "Delivered" or "Failed")
   with its own delivery timestamp.

## Expected Results (per spec) vs. What To Actually Check

- **Per spec AS1**: the INITIAL NOTIFICATION should be sent to *Cognizant QA
  Staff, Cognizant Group Leader, and Cognizant Division Director or Project
  Manager* — i.e. multiple recipients resolved by organizational role.
- **Per spec AS3**: the confirmation view should show, for each of those
  stakeholders, that they were notified with a timestamp.
- Actually verify which of these is true by reading the real recipient list
  from step 5, rather than assuming the spec's intended recipients were
  used.

## Human Verification Checklist

- [ ] Open the `ncrs` document in mongo-express and read
      `events[].recipients` for the `notification.initial` entry directly
      (don't rely solely on the rendered payload view, which may truncate).
- [ ] **Compare the actual recipient list against the spec's requirement**
      (QA Staff, Group Leader, Division Director/PM). If the only recipient
      recorded is the NCR Originator themselves (i.e. the same
      `recipient_id` as the NCR's `originator_id`), this is a **spec/implementation
      mismatch** worth flagging — `createNcr()` in `lib/ncr-service.js`
      currently builds the initial-notification recipient list from the
      Originator only (`originatorRecipient`), not from any QA
      Staff/Group Leader/Division Director role lookup. Confirm this by
      reading the `createNcr` function directly.
- [ ] Each recipient entry has `delivery_status` and `delivery_timestamp`
      fields populated (even if the underlying SMTP send is mocked/fails in
      your dev environment, the event should still record an attempt).
- [ ] Confirm a **separate** `notification.disposition_request` event is
      only present when the NCR was created with a `ce_cs_id` — this is
      the CE/CS-specific request covered by `us1.6-request-engineering-disposition.md`,
      not this notification.
