# NCR Feature — User Verification Plan

**Feature**: Nonconformance Workflow Management (NCR)

## Purpose

Define how the NCR feature gets verified from a user's point of view before
it's considered ready, without letting cosmetic polish block sign-off.

## Two-part verification model

Each user story gets checked in two passes, producing two separate outputs
— not one pass/fail verdict:

1. **REQUIRED — MVP accepted?** Does the story's core workflow work
   end-to-end per its written acceptance scenarios? If any
   REQUIRED item failed, then we need to fix it before verifying the next user story.
2. **RECOMMENDED — improvements found.** Anything noticed that would
   improve the experience but doesn't block a user from completing the
   workflow (unclear labels, extra clicks, inconsistent styling, etc.).
   Logged and triaged afterward into High/Medium/Low and scheduled as separate follow-up work.

## Per-story verification checklist

| # | Story | REQUIRED (MVP) scope | Verification |
|---|---|---|---|
| US1 | Create and Submit NCR | Mandatory fields present; NCR number assigned + Submitted status; full audit trail visible; validation blocks incomplete submission | |
| US1.5 | Send Initial Notification | Notification sent to QA Staff, Group Leader, Division Director/PM on submission; delivery status visible per recipient | |
| US1.6 | Request Engineering Disposition | Separate CE/CS disposition-request email sent with NCR link; CE/CS assignment recorded; Originator Delegate can be designated | |
| US2 | CE/CS Performs Engineering Disposition | Disposition form exposes all mandatory fields; Rework/Repair requires instructions; submission records identity, timestamp, details; incomplete submission blocked | |
| US3 | QA Concurrence and Approver Coordination | No-approvers path → Final Approval; with-approvers path → Approved + notifications; approve; return-for-comment; QA resubmit; QA Reject | |
| US4 | Track and Report on Nonconformances | Dashboard status counts; filters (Part Number/Root Cause/Date/Disposition); 30+ day escalation flag; average-time-in-workflow figure | |
| US5 | NCR Issuance and Execution | Issuance email; access to approved disposition; close-with-notes; Traveler-linked closure blocks until sign-off confirmed | |
| US6 | Final NCR Distribution and Closure Archive | Final-distribution email reaches all 5 required recipient groups; closed NCR excluded from active list but remains searchable | |
| US7 | Preventive Action Tracking and Management | PA capture from disposition; owner assignment + notification; status updates; closure; completion-notification check | |
| US8 | Integrate NCR Creation from Traveler | Launch NCR creation from an eTraveler step, pre-populated from Traveler context | |
| — | Access Control & Validation (cross-cutting) | Wrong-role requests rejected (403); missing records return 404; validation errors surfaced correctly | |

## Improvement backlog process for recommendations

1. Log every improvement noted during verification, tagged with the story
   it came from.
2. After a full verification round, triage the whole list together (the
   same issue often recurs across stories) into:
   - **High** — likely to cause user confusion
   - **Medium** — friction/inconsistency that slows users down
   - **Low** — cosmetic
3. Prioritized items become follow-up backlog work.

## Reporting

Each verification round produces:

- A per-story result: **Accepted** / **Failed** / **Not Implemented —
  blocked**, plus any improvements found (or "None observed").
- A consolidated, de-duplicated, prioritized improvement backlog.
- An issue description for any **Failed** story.

A round is complete only when every in-scope story shows **Accepted**.
