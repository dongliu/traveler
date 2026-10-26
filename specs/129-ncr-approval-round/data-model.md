# Phase 1 Data Model: NCR Approval Rounds

All changes are to the existing `Ncr` model (`model/ncr.js`). No new collection, no new model file — consistent with research.md's D1 decision to keep the round concept lightweight.

## `NcrSchema` — new field

| Field | Type | Notes |
|---|---|---|
| `current_approval_round` | `Number` | Absent/`undefined` until the first time QA concurs with ≥1 approver. Set to `1` on that first `concurWithApprovers`; incremented by `1` each later time `submitConcurrence` is called with ≥1 approver (i.e., each time a *new* round starts). Never changes when QA concurs with zero approvers (`concurNoApprovers`) — no round exists in that path. Never decremented; a stopped round's number is never reused. |

## `NCR_STATUSES` — value removed

`'Returned for Comment'` is removed. Resulting enum:

```
['Submitted', 'Dispositioned', 'Approval Requested', 'Final Approval', 'Closed']
```

Every other consumer of `NCR_STATUSES` (`status` field's enum validator, `getStatusCounts`'s per-status counters) picks this up automatically — neither iterates a separately-maintained list.

`POST_DISPOSITION_STATUSES` (`lib/ncr-service.js`, used only by `buildRoleScope` to decide which statuses a QA-staff member can see *by virtue of being QA*, regardless of personal involvement) drops `'Returned for Comment'` for the same reason; the remaining four values are unchanged.

## `additional_approvers[]` — unchanged shape, new usage rule

No field is added or removed. `approval_status`'s enum stays `['Pending', 'Approved', 'Returned for Comment']` — the *approver's own decision* value is untouched by this feature (FR-004); only the NCR's own top-level `status` loses that value.

**New rule** (FR-002/D5): once an entry's `approval_status` leaves `'Pending'` (becomes `'Approved'` or `'Returned for Comment'`), it is final for that round. A second decision from the same `approver_id` against the same open round is rejected before any field is written.

**Lifecycle per round** (unchanged mechanism, just now counted): `submitConcurrence` replaces the entire array with one entry per newly-designated approver, each `{ approver_id, approver_name, approver_email, designated_timestamp, approval_status: 'Pending' }`. `addApprover`/`removeApprover` may still mutate the array while the round is open (`ncr.status === 'Approval Requested'`).

## `NcrEventSchema` — new field

| Field | Type | Notes |
|---|---|---|
| `round` | `Number` | Set on every event raised while handling a concurrence or approval-round action (`qa.concurred`, `approvers.designated`, `approval.approved`, `approval.returned_for_comment`, `approver.added`, `approver.removed`, `notification.approval_request`), to `ncr.current_approval_round` at that moment. Absent on event types unrelated to approval rounds (e.g. `ncr.submitted`, `disposition.submitted`, `ncr.closed`), exactly like `previous_status`/`new_status` are already absent on events where they don't apply. |

`NCR_EVENT_TYPES` is unchanged — no value added, none removed (research.md D3).

## Conceptual entities (from spec.md), mapped to the above

- **Approval Round** → not a separate stored document; it's the pairing of `(ncr.current_approval_round, ncr.additional_approvers)` while the round is open, and `(round number stamped on each ncr.events[] entry)` for every round, open or already decided, once you're reading history rather than current state.
- **Approver Decision** → one `additional_approvers[]` entry (while the round is open) and/or the `approval.approved` / `approval.returned_for_comment` event that recorded it (`events[].round` ties it to its round permanently, even after the next round replaces `additional_approvers`).

## State field summary (post-change)

| `ncr.status` value | Meaning | Reachable from |
|---|---|---|
| `Submitted` | Awaiting CE/CS disposition | (initial) |
| `Dispositioned` | Awaiting QA concurrence — either for the first time, or again after a round was stopped | `Submitted`, `Approval Requested` (via `returnForComment`) |
| `Approval Requested` | A round is open; approvers are deciding | `Dispositioned` |
| `Final Approval` | Issued | `Dispositioned` (no approvers), `Approval Requested` (round fully approved) |
| `Closed` | Done | `Final Approval` |

`Returned for Comment` no longer appears in this table — it is eliminated, not relocated.
