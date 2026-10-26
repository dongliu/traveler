# Phase 1 Data Model: QA Reject with Comments

All changes are to the existing `Ncr` model (`model/ncr.js`). No new collection, no new model file — consistent with research.md's D1 decision to represent rejection the same way every other NCR decision point is already represented.

## `NCR_STATUSES` — value added

`'Rejected'` is added. Resulting enum:

```
['Submitted', 'Dispositioned', 'Approval Requested', 'Rejected', 'Final Approval', 'Closed']
```

(Inserted after `Dispositioned` to keep the enum in roughly lifecycle order; enum member order has no behavioral effect — `getStatusCounts` and the schema's own validator both treat it as an unordered set of valid values.)

## `NcrSchema` — new field

| Field | Type | Notes |
|---|---|---|
| `qa_rejection_comments` | `String` | QA's comment from the most recent `'Reject with Comments'` action. Set by `rejectConcurrence`; read directly by `views/ncr-detail-body.jade` and `views/ncr-resubmit.jade` so the Originator/Designate can see *why* without parsing `events[]`. Like `ncr.disposition` and `ncr.additional_approvers`, this is a "latest state" field, not a history list — if the NCR is rejected more than once across separate cycles, only the most recent comment is here; every rejection's comment is also permanently retained on its own `qa.rejected` event (`events[].payload.comments`), satisfying FR-010 regardless of how many times this field is overwritten. |

`qa_staff_identity`, `qa_staff_name`, and `qa_concurrence_timestamp` (existing fields, today only ever set by `submitConcurrence`) are also set by `rejectConcurrence`, for the same reason they're set by the other two concurrence outcomes: they record who made the most recent QA decision at this decision point and when, regardless of which of the three outcomes QA chose.

## `NCR_EVENT_TYPES` — value added

`'ncr.resubmitted'` is added (research.md D2). `'qa.rejected'` already existed (unused); no change needed to the enum for it.

| Event type | Raised by | actor_role | payload |
|---|---|---|---|
| `qa.rejected` | `rejectConcurrence` | `qa_staff` | `{ comments }` |
| `ncr.resubmitted` | `resubmitNcr` | `originator` | `{ part_name, part_number }` (same shape `ncr.submitted`'s payload already uses) |

Both events set `previous_status`/`new_status` exactly like every other status-changing event already does (`'Dispositioned'` → `'Rejected'`, and `'Rejected'` → `'Submitted'`, respectively). Neither sets `round` — rejection happens at the QA-concurrence decision point, before any approval round exists for that cycle, so it is not approval-round-scoped (same reason `qa.concurred`'s zero-approver branch does not set `round` either).

## `NCR_EVENT_TYPES` — new notification value

`'notification.qa_rejection'` is added, following the existing `notification.*` naming pattern. Logged once per rejection via the existing `appendNotificationEvent(ncr, 'notification.qa_rejection', results)` helper — no change to that helper's signature.

## Fields deliberately NOT changed

- `additional_approvers`, `current_approval_round`, `disposition`: left as-is (stale) through the `Rejected`/`Submitted` window, exactly as they are already left stale between any two QA decision points today. The next `submitDisposition` (on resubmission) and the next `submitConcurrence`/`rejectConcurrence` (after that) each wholesale-overwrite their own field, same as always — see research.md D1 of spec 129 for why this has always been safe for `additional_approvers`, and research.md D4 here for `disposition`.
- `ce_cs_id` / `ce_cs_name` / `ce_cs_email`, `originator_id` / `originator_designate_id`: not editable via resubmission (research.md D6). Reassigning CE/CS is out of scope for this feature; Designate assignment/removal already has its own dedicated action (`assignDesignate`/`removeDesignate`).

## State field summary (post-change)

| `ncr.status` value | Meaning | Reachable from |
|---|---|---|
| `Submitted` | Awaiting CE/CS disposition (first time, or again after a rejection was corrected) | (initial), `Rejected` (via `resubmit`) |
| `Dispositioned` | Awaiting QA concurrence — first time, again after a round was stopped, or again after a prior rejection cycle's resubmission went back through disposition | `Submitted`, `Approval Requested` (via `returnForComment`) |
| `Rejected` | QA rejected the NCR; only the Originator/Designate can act, by updating and resubmitting | `Dispositioned` (via `reject`) |
| `Approval Requested` | A round is open; approvers are deciding | `Dispositioned` |
| `Final Approval` | Issued | `Dispositioned` (no approvers), `Approval Requested` (round fully approved) |
| `Closed` | Done | `Final Approval` |

`Rejected` has exactly one way in (`Dispositioned`, via QA's `reject`) and exactly one way out (`Submitted`, via the Originator/Designate's `resubmit`) — no other transition references it, so it cannot be reached or left any other way.
