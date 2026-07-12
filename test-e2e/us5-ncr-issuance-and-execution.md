# Test E2E — User Story 5: NCR Issuance and Execution

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 5 - NCR
Issuance and Execution" (Priority: P2)
**Files under test**: `views/ncr-close.jade`, `routes/ncr.js` (`POST /api/ncr`, `PATCH /api/ncr/:id/close`), `lib/ncr-service.js` (`createNcr`, `closeNcr`)

## Setup — Part A (standalone NCR)

- Requires NCR-A from `us3-qa-concurrence-and-approver-coordination.md`,
  currently in `Final Approval` status, with no `traveler_link`.
- `closeNcr` requires the caller's session id to equal `ncr.originator_id`
  — log back in as the same user who created NCR-A in
  `us1-create-and-submit-ncr.md`.

## Setup — Part B (Traveler-linked NCR, Acceptance Scenario 5)

- The standalone NCR creation page has **no** UI for linking an NCR to a
  Traveler (see spec.md "Future Work: eTraveler UI Integration"). Create
  this fixture via a direct API call instead, using your active session
  cookie.

## Test Steps for Claude in Chrome

### Acceptance Scenario 1 — issuance email sent on Final Approval (verify as precondition)

1. Navigate to `http://localhost:3001/ncr/<ncr-a-id>` and open the Event
   Timeline. Confirm a `notification.issuance` event already exists (it was
   created when NCR-A reached Final Approval in the US3 test) — this
   confirms AS1 without needing to re-trigger it here.

### Acceptance Scenarios 2, 3, 4 — Originator accesses NCR, executes, closes it (NCR-A)

2. Confirm a "Close NCR" button is visible on the detail page (only shown
   when status is `Final Approval`) — this stands in for "clicking the
   issuance email link", since both routes lead to the same NCR (AS2).
3. Click "Close NCR".
4. Confirm the "Approved Disposition" section shows the correct parts
   disposition, root cause, and rework/repair instructions, and the
   Preventive Actions section lists both actions with status (AS2/AS3).
5. Confirm there is **no** "Traveler Sign-Off" section on this page (NCR-A
   is not Traveler-linked).
6. In "Closure Notes", enter: `Rework completed per instructions, re-inspected under magnification, dimensions verified within tolerance. Both preventive actions implemented and confirmed.`
7. Check both checkboxes: "I have verified the disposition has been
   executed" and "I have verified the preventive actions have been
   completed".
8. Click "Close NCR" (AS4).
9. Read the success message. Click "View NCR". Confirm the status badge
   reads "Closed" and a "Closure" section shows your name, today's date,
   and the closure notes.

### Acceptance Scenario 5 — Traveler-linked NCR requires sign-off confirmation before closing

10. Open DevTools Console (any authenticated page) and run:

    ```js
    fetch('/api/ncr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        part_name: 'Traveler Linked Bracket',
        part_number: 'BA-E2E-TRAV',
        part_revision: 'A',
        quantity: 1,
        supplier_name: 'Acme Fabrication',
        wbs_number: 'WBS-E2E-TRAV',
        specification_drawing_reference: 'DWG-E2E-TRAV',
        description_of_nonconformance: 'Traveler-linked test NCR created directly via API for closure testing.',
        discovery_date: new Date().toISOString().slice(0, 10),
        discovery_context: 'in_house_assembly',
        traveler_id: '507f1f77bcf86cd799439011',
        traveler_step_number: 7,
      }),
    }).then(r => r.json()).then(console.log);
    ```
11. Record `ncr.ncr_number` / `ncr.ncr_id`. In mongo-express, open that
    document and confirm it already has `traveler_link: { traveler_id:
    "507f1f77bcf86cd799439011", step_number: 7, initiated_from_traveler:
    true }` (set automatically because `traveler_id` was in the request).
12. Edit the document: set `status` to `"Final Approval"` (fast-forwarding
    past disposition/QA/approval, already covered by other user-story
    tests, to isolate this test to the closure step).
13. Navigate to `http://localhost:3001/ncr/<that-ncr-id>/close`.
14. Confirm a "Traveler Sign-Off" section is visible with the text: "This
    NCR was initiated from a Traveler. Electronic confirmation of traveler
    sign-off is required before closure." and a checkbox: "I confirm the
    associated Traveler step has been signed off".
15. Enter closure notes (≥ 20 characters), leave the sign-off checkbox
    **unchecked**, click "Close NCR". Read the error.
16. Check the sign-off checkbox and click "Close NCR" again. Read the
    success message.

## Expected Results

- Steps 2–9: standard closure succeeds; success banner reads "NCR closed.
  Final distribution sent to all stakeholders."
- Step 15: client-side validation blocks submission: "Traveler sign-off
  confirmation is required." No network request is sent.
- Step 16: closure succeeds with the same success banner as standalone
  closure.

> **Implementation note** (already documented in spec.md): the sign-off in
> step 16 is a self-attestation checkbox on the NCR's own closure form — it
> is not an electronic sign-off performed inside an eTraveler UI, and no
> electronic copy of the closed NCR is attached to any Traveler record
> (there is nothing to attach it to, since no eTraveler integration exists
> yet). Confirm this is indeed all that happens — don't expect to find a
> corresponding record anywhere outside this NCR document.

## Human Verification Checklist

- [ ] NCR-A (`ncrs` document): `status: "Closed"`,
      `closure_record.closure_notes` matches the text entered,
      `closure_record.disposition_execution_verified: true`,
      `closure_record.preventive_actions_verified: true`. `events`
      contains `ncr.closed` and `notification.final_distribution`, but
      **not** `traveler.signed_off`.
- [ ] The Traveler-linked NCR's document (Part B): `status: "Closed"`,
      `closure_record.traveler_signed_off: true`. `events` contains a
      `traveler.signed_off` entry with `payload.traveler_id` and
      `payload.step_number` matching what was set at creation, in addition
      to `ncr.closed` and `notification.final_distribution`.
- [ ] Confirm directly in `views/ncr-create.jade` that no `traveler_id`/
      `traveler_step_number` input exists anywhere — this is the contract
      this test's Part B setup step is working around, not a bug in the
      test.
