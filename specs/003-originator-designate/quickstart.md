# Quickstart: NCR Originator Designate Assignment

**Feature**: `003-originator-designate` | **Spec**: [spec.md](./spec.md)

## What this feature adds

An NCR Originator can assign one other user as their Designate on a specific
NCR. The Designate can then view that NCR, receive the same ISSUANCE and
FINAL NCR DISTRIBUTION emails the Originator receives for it, and close it —
exactly as if they were the Originator, but only for that NCR.

## Manual verification (once implemented)

1. As User A, create an NCR (User A becomes its Originator).
2. Open the NCR detail page. A "Designate" field appears in the Reference
   section, empty, with an "Assign" control visible only to User A (the
   Originator).
3. Type an existing user's display name (same typeahead as the CE/CS field
   on NCR creation) and confirm the assignment.
4. Confirm: the Designate's name now shows on the NCR detail page; the
   assigned user (User B) receives a notification email with a link to the
   NCR; the NCR's event timeline shows a `delegate.assigned` entry.
5. Log in as User B. Confirm the NCR appears in User B's own NCR
   dashboard/list, and User B can open it.
6. As User B, attempt to change or remove the Designate assignment itself —
   confirm this is rejected (only User A, the actual Originator, can).
7. Bring the NCR to "Final Approval" status. Confirm the ISSUANCE email goes
   to both User A and User B.
8. As User B, close the NCR with closure notes. Confirm the NCR transitions
   to "Closed", and the closure record/audit trail identifies User B (not
   User A) as the one who closed it.
9. Confirm the FINAL NCR DISTRIBUTION email (sent on closure) goes to both
   User A and User B.
10. On a different NCR where User B has no relationship, confirm User B has
    no special access — Designate authority does not carry across NCRs.
11. On a Closed NCR, confirm neither Originator nor anyone else can assign,
    change, or remove its Designate.

## Automated verification (once implemented)

- Unit: `npx mocha test-unit/lib/ncr-service.test.js` — new `describe`
  blocks for `assignDesignate`/`removeDesignate`, plus updated assertions on
  `closeNcr`, `buildRoleScope`, and issuance/final-distribution recipient
  building.
- E2E: a new Playwright spec file under `e2e/` (reusing the fixture CLI and
  Mailpit client already built for `specs/002-playwright-e2e-tests`) driving
  the manual verification steps above against the real running app.
