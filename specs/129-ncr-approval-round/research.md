# Phase 0 Research: NCR Approval Rounds

## D1: How to represent an "approval round" on the NCR document

**Decision**: Add one new scalar field, `current_approval_round` (Number), to `NcrSchema`. It holds the sequence number (starting at 1) of the round that `additional_approvers` currently represents. `additional_approvers` keeps its existing shape and existing behavior — QA's concurrence decision (`submitConcurrence`) still *wholesale-replaces* the array with the newly designated approvers, exactly as it does today. The only change is that doing so also sets `current_approval_round` (1 the first time, incremented by 1 each later time concurrence designates ≥1 approver). Every approval-round-scoped event already pushed to `ncr.events` (`qa.concurred`, `approvers.designated`, `approval.approved`, `approval.returned_for_comment`, `approver.added`, `approver.removed`, `notification.approval_request`) gets one new field, `round`, set to `ncr.current_approval_round` at the moment it's recorded.

**Rationale**: The spec's own Assumptions scope round-history surfacing to the event timeline (FR-010), not to `additional_approvers` itself, and the spec deliberately does not add a standalone round-history view. Given that, the simplest design that satisfies every functional requirement is: keep `additional_approvers` meaning exactly what it means today ("the approvers of the currently active round, and their decisions"), and let the event log — already the system's append-only audit trail for everything else (closure records, PA status history) — carry cross-round history, now labeled by round number. This requires no change to the *shape* of `additional_approvers`, so the REST API's existing `additional_approvers` field in `PATCH /concurrence`, `/approve`, `/approvers` responses keeps meaning what external integrations already expect it to mean.

Because `submitConcurrence` already replaces the array wholesale on every concurrence decision, there is no risk of a stale decision from an old round leaking into the "is this round fully approved" check (`maybeFinalApprove`) — the array simply never contains anything but the current round's entries. This achieves the same guarantee `model/review.js`'s version-filtering (`reviewResults.filter(r => r.v === docVersion && !r.voided)`) achieves for reviews, without needing to replicate that filtering mechanism: `review.js` must filter because it *never* removes old `reviewResults`, whereas NCR approvers were already being replaced per round before this feature existed.

**Alternatives considered**:
- *Mirror `review.js` literally*: never replace `additional_approvers`; instead append every round's approvers into one ever-growing array, each entry stamped with `round`, and filter by `round === current_approval_round` wherever the code currently reads `additional_approvers`. Rejected: this changes the shape/semantics of a field already returned by several REST endpoints (now a full cross-round history instead of "current approvers"), which no part of the spec asked for, and it would require updating every one of the ~6 read-sites of `additional_approvers` (views and routes) to filter by round, for no behavioral benefit over D1.
- *Put the round number only in `events[].payload` (`Schema.Types.Mixed`), not a dedicated field*: rejected because the Event Timeline view renders generic fields (`event_type`, `actor_name`, `previous_status`/`new_status`) directly, not `payload` contents; a dedicated `round` field lets the timeline render it with the same one-line generic treatment as `previous_status`/`new_status`, with no per-event-type special-casing.

## D2: Removing "Returned for Comment" as an NCR status value

**Decision**: Remove `'Returned for Comment'` from `NCR_STATUSES` (`model/ncr.js`) and from `POST_DISPOSITION_STATUSES` (`lib/ncr-service.js`). Do **not** remove it from `additional_approvers[].approval_status`'s enum — that enum is the approver's own decision value, which this feature keeps (FR-004).

**Rationale**: Directly implements the clarified scope decision. `getStatusCounts` (`lib/ncr-service.js`) derives its dashboard counts by iterating `NCR_STATUSES`, so removing the value there automatically drops it from `/api/ncrs/status-counts` with no separate code change.

## D3: Don't remove now-unproduced `event_type` / historical enum values

**Decision**: Leave `'qa.resubmitted'` in `NCR_EVENT_TYPES` even though no code path will produce it after this change. Do not introduce any new event type — `'qa.concurred'` already narrates a round starting and `'approval.returned_for_comment'` already narrates a round stopping; both just gain the new `round` field (D1).

**Rationale**: Mongoose 7 validates the full document (including every existing element of an array subdocument) on every `.save()` unless a path is explicitly excluded. Any NCR whose event history already contains a `qa.resubmitted` event (which existed for as long as this feature's predecessor, spec 121, has been live) would fail to save ever again if `'qa.resubmitted'` were removed from the enum — an easy, serious, and easy-to-miss regression. This repo's own convention (see `003-originator-designate`'s `delegate.removed` addition, kept even though a later change, `127-upsert-user-on-stakeholder-add`, made one of its callers' fields obsolete) is additive-only for this exact reason. The clarified "assume no NCR is currently *in* `Returned for Comment` status" answer is specifically about the live `status` field, not about historical `events[].event_type` values, which this decision treats as a separate, stricter concern.

## D4: Remove the now-impossible "resubmit the same round" path

**Decision**: Delete, rather than adapt:
- `qaResubmit` (`lib/ncr-service.js`) and its export.
- `PATCH /api/ncrs/:id/resubmit` (`routes/ncr.js`).
- The `resubmitToApprovers` and `unblock` transitions from `lib/ncr-state-machine.js`.
- The `wasBlocking` / post-removal `fsm.unblock()` branch inside `removeApprover` (`lib/ncr-service.js`) — it exists solely to recover from the now-eliminated "stuck in Returned for Comment" state.
- The "QA Action / Resubmit to Approvers" fieldset and its `#resubmit-btn` handler in `views/ncr-approval.jade`.

**Rationale**: Under the new design there is no NCR state in which "reset the blocking approver(s) back to Pending and continue the same round" is ever a legal action — the round is already over (back in Dispositioned) the instant it was stopped. Keeping the function/route/transition around unreachable would be dead code the Constitution's Code Quality principle (avoid duplication/unused complexity) argues against, and leaving a route live that can never legally fire (status is never `Returned for Comment`, so `qaResubmit`'s own guard would 409 on every call) is worse than removing it outright.

**Breaking change**: `PATCH /api/ncrs/:id/resubmit` stops existing (404 after removal) — same treatment as the precedent in `specs/007-wbs-yaml-config` ("Breaking change: ... no longer exist (return 404)"). This is called out explicitly in `plan.md`'s Constitution Check (Principle IV) and must get a CLAUDE.md "Recent Changes" entry on implementation, per house convention.

## D5: Decision finality within an open round

**Decision**: `returnForComment` gains the same guard `submitApproval` already has: if the calling approver's current entry is not `'Pending'`, reject with 409 (reusing the existing "You have already approved/decided this NCR" style error), instead of unconditionally overwriting their decision as it does today.

**Rationale**: Directly implements the clarified answer. Today `submitApproval` already blocks a second `approve` from the same person (`if (approverEntry.approval_status === 'Approved') throw 409`), but `returnForComment` has no equivalent guard — it will happily overwrite even an `'Approved'` entry. This decision closes that asymmetry rather than introducing a new mechanism.

## D6: No new notification path

**Decision**: No code adds a notification to not-yet-decided approvers when a round stops. `sendQaNotification(ncr, qaStaff, 'returned_for_comment', ncrUrl)` (`lib/ncr-email.js`) keeps firing exactly as it does today; only its body copy's phrase "resubmit to approvers if appropriate" is updated (to something like "designate approvers again if another round is needed"), since "resubmit" no longer describes any real action after D4.

**Rationale**: Directly implements the clarified answer; a stale approval-request link now simply 409s via the existing `ncr.status !== 'Approval Requested'` guard already in `submitApproval`/`returnForComment` (no new error path needed — FR-014 is satisfied by logic that already exists today for the equivalent case).

## D7: State machine transition table

**Decision**: `lib/ncr-state-machine.js` becomes:

| Transition | From | To |
|---|---|---|
| `submitDisposition` | `Submitted` | `Dispositioned` |
| `concurNoApprovers` | `Dispositioned` | `Final Approval` |
| `concurWithApprovers` | `Dispositioned` | `Approval Requested` |
| `returnForComment` | `Approval Requested` | `Dispositioned` |
| `finalApprove` | `Approval Requested` | `Final Approval` |
| `close` | `Final Approval` | `Closed` |

`resubmitToApprovers` and `unblock` are removed (D4). `finalApprove`'s `from` is now the single state `'Approval Requested'`, never `'Returned for Comment'` (which no longer exists) — this is the literal fix for "no path from 'Approval Requested' or 'Returned for Comment' to go to Final Approval [without the round being fully approved]": the only edge into `Final Approval` from the approval sub-flow is this one, and the call site (`maybeFinalApprove`) only invokes it after confirming every current-round approver is `'Approved'`.

**Rationale**: Minimal edit that satisfies FR-003, FR-005, and FR-006 directly; every other existing transition is untouched.

## D8: Surfaces that read/branch on `ncr.status === 'Returned for Comment'` today

Enumerated so Phase 2 (`/speckit.tasks`) has a complete punch list; no new decisions needed beyond D1–D7, these are direct consequences:

| File | What changes |
|---|---|
| `views/ncr-approval.jade` | Remove `isReturnedForComment`; `canManageApprovers` becomes `isQa && ncr.status === 'Approval Requested'`; remove the "QA Action" fieldset and `#resubmit-btn` JS (D4); add `if event.round` → render it, next to the Event Timeline's existing `previous_status`/`new_status` line (this view doesn't currently render a timeline — no-op here; applies to `ncr-detail-body.jade` below). |
| `views/ncr-detail-body.jade` | `canManageApprovers` becomes `isQa && ncr.status === 'Approval Requested'`; Event Timeline partial gains `if event.round` rendering (no other status branch needed — the four `can*` next-action booleans added by spec 128 never special-cased `Returned for Comment`; it already falls through to "no button," which stays correct since that status is simply unreachable now). |
| `views/ncr-dashboard.jade` | Remove the `Returned for Comment` status card, its entry in the status→color map, and the `.count-Returned` counter line. |
| `lib/ncr-email.js` | Reword `sendQaNotification`'s `returned_for_comment` body copy (D6); subject line wording is kept per spec Assumptions. |

No change needed in `lib/ncr-pdf.js` or its tests — they use `'Returned for Comment'` only as a sample *approver's* `approval_status` value (unaffected by this feature), never as `ncr.status`.
