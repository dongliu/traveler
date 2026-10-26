# Phase 0 Research: QA Reject with Comments

## D1: Representing "Rejected" as a new NCR status

**Decision**: Add `'Rejected'` to `NCR_STATUSES` (`model/ncr.js`), reachable only from `Dispositioned` (new `reject` transition) and leaving only to `Submitted` (new `resubmit` transition). No other existing status, transition, or field shape changes.

**Rationale**: Mirrors exactly how `'Approval Requested'`/`'Final Approval'` already work — a plain top-level status value driving `lib/ncr-state-machine.js`, `views/*.jade` status badges, and `getStatusCounts`. No new entity/collection is needed; FR-003's "transition the NCR to a new status, distinct from every existing status" is satisfied by the enum addition alone.

**Alternatives considered**: Modeling rejection as a flag/sub-document on top of the existing `Dispositioned` or `Submitted` status (e.g., `ncr.rejected: true` while status stays `Dispositioned`) — rejected because every other decision point in this system (Approval Requested, Final Approval, and 129's since-removed Returned for Comment) already expresses "the NCR is waiting on a specific party to do a specific thing next" as a distinct top-level status, and every view/dashboard/permission check in this codebase branches on `ncr.status`. A flag would require parallel branching everywhere `ncr.status` is already read, for no benefit.

## D2: Event types

**Decision**:
- Reuse `'qa.rejected'` (already present in `NCR_EVENT_TYPES`, unused) for the rejection event, actor_role `'qa_staff'`.
- Add one new value, `'ncr.resubmitted'`, for the Originator/Designate's update-and-resubmit event, actor_role `'originator'`.
- Do **not** reuse the existing `'qa.resubmitted'` value for this — that value was produced only by the now-removed `qaResubmit` action (spec 129 D4: QA resubmitting the *same approval round*, a QA-staff action), kept in the enum solely so pre-existing documents containing it still pass Mongoose's full-document validation on save (spec 129 D3). This feature's resubmission is a different actor (Originator/Designate, not QA) acting on a different status (`Rejected`, not `Approval Requested`/`Returned for Comment`) for a different reason (fixing a flawed submission, not continuing a blocked approval round). Reusing the string would make the event history ambiguous between two unrelated actions across the NCR's lifetime.

**Rationale**: `'qa.rejected'` was added to `NCR_EVENT_TYPES` in an earlier spec specifically for this not-yet-implemented capability (confirmed by `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`'s `AS9`, which asserts today that no `qa.rejected` event is ever produced — i.e., it documents the exact gap this feature closes). Using it keeps the enum additive-only, per this repo's established convention (research.md D3 of spec 129; `003-originator-designate`'s kept-but-unused `delegate.removed` before `delegate.assigned` existed).

## D3: Notification event type and recipients

**Decision**: Add one new notification event type, `'notification.qa_rejection'`. On rejection, send **one** email, in the same "everyone on one `to:` line" shape `sendInitialNotification` already uses for QA+WBS-contact, to: all QA staff (`findQaStaff()`) + the Originator + the Originator Designate (only if `ncr.originator_designate_id` is set). Record the single `appendNotificationEvent(ncr, 'notification.qa_rejection', results)` call the same way every other notification step already does.

**Rationale**: FR-008 requires the same comment and link to reach all three audiences; nothing in the spec asks for audience-specific wording, so one shared email keeps this consistent with `sendInitialNotification`'s existing precedent rather than introducing a second, role-specific template for no required benefit. FR-009 ("no notification addressed to a non-existent Designate") falls out for free from `sendToRecipients`' existing `.filter(Boolean)` over the recipient list — passing `undefined` for a missing designate email is already handled everywhere else in this codebase (e.g. `createNcr`'s `[ncr.originator_id, ncr.originator_designate_id].filter(Boolean)`).

## D4: Resubmission re-triggers the CE/CS disposition request

**Decision**: `resubmitNcr` (new function) calls `sendDispositionRequest` (existing, unchanged) and logs `appendNotificationEvent(ncr, 'notification.disposition_request', ...)` — the exact same call `createNcr` already makes — addressed to `ncr.ce_cs_email` if present, CC'd to the resubmitting user, same as today.

**Rationale**: Directly implements FR-007. The spec's own Assumptions note that resubmission "intentionally restarts the full engineering disposition and QA concurrence cycle rather than resuming mid-flow" — CE/CS has no other way to learn a fresh disposition is needed, since nothing else in this codebase polls for `status === 'Submitted'`. Reusing `sendDispositionRequest` verbatim (rather than writing a new "re-disposition" template) means CE/CS sees the identical call-to-action email whether the NCR is brand new or has been rejected and corrected — there is no functional difference between the two from CE/CS's side.

**Note**: `ncr.ce_cs_email` is only ever captured on NCR creation and is not one of the editable resubmission fields (D6) — if it was never captured (no `ce_cs_email` given at creation and no local `User` record resolving one), the disposition-request email silently has no recipient, exactly as happens today on initial creation (`routes/ncr.js` POST `/` already guards this with `if (data.ce_cs_email)`). This feature does not add a way to change the assigned CE/CS from the Rejected/Submitted state.

## D5: Reject and resubmit endpoints

**Decision**:
- Extend `PATCH /api/ncrs/:id/concurrence`: when the request body includes `action: 'reject'`, require `comments` (non-blank) and call a new `rejectConcurrence(ncrId, comments, user, webBaseUrl)` instead of `submitConcurrence`. When `action` is absent, behavior is **unchanged** (today's implicit "approvers array present or not" dispatch) — this keeps the existing UI/API contract for the two decisions in place and only adds the third alongside it.
- Add `PATCH /api/ncrs/:id/resubmit` — a **new use** of a path this codebase previously exposed for an unrelated purpose (spec 129 removed the old `PATCH /api/ncrs/:id/resubmit`, which let QA resubmit the same blocked approval round; see D2). That endpoint has returned 404 since spec 129 shipped, so reusing the path now introduces no ambiguity for any client written against the old behavior — a 404 before, a 200 now, never a silent behavior change on the same input shape (the old endpoint took no body; this one requires one). Called by the Originator/Designate with the same editable-field body shape `POST /api/ncrs` (creation) already accepts (D6); calls new `resubmitNcr(ncrId, data, user, webBaseUrl)`.

**Rationale**: `PATCH /:id/approve`'s existing `action: 'approve' | 'return_for_comment'` dispatch (`routes/ncr.js:459`) is the direct precedent for adding a third decision to a decision-point endpoint via an `action` field rather than a new route — reusing that exact shape for `/concurrence` is the smallest change that satisfies FR-001 without touching the two decisions that already exist. A brand-new route is justified for resubmission because, unlike reject-vs-concur, "update these fields and resubmit" has a materially different request body (the full editable NCR, not a short decision+comment) from anything `/concurrence` already accepts.

**Alternatives considered**: A generic `PATCH /api/ncrs/:id` for arbitrary field edits, gated to the `Rejected` status — rejected as broader than this feature needs (FR-005 only requires edits while `Rejected`, and a fully generic edit endpoint invites edits from other statuses this feature was never asked to support) and as a path collision risk with the existing `GET /api/ncrs/:id`/`DELETE /api/ncrs/:id` semantics on the same base route.

## D6: Editable fields on resubmission

**Decision**: `resubmitNcr`'s body accepts the same field set and validation `createNcr` already requires at NCR creation (`part_name`, `part_number`, `part_revision`, `quantity`, `supplier_name`, `wbs_number`, `specification_drawing_reference`, `po_reference`, `description_of_nonconformance`, `discovery_date`, `discovery_context`) and overwrites them on the existing NCR document in place — no new sub-document, no versioning/diff of the previous values. `ce_cs_id`/`ce_cs_name`/`ce_cs_email` and `originator_id`/`originator_designate_id` are **not** editable here (CE/CS and Designate reassignment are each already their own, separate action elsewhere in this codebase).

**Rationale**: Directly implements the spec's Assumptions ("Update the NCR' means the Originator/Designate may edit the same submitted information they could edit when the NCR was first created... this feature does not introduce a separate, restricted edit form"). Reusing `createNcr`'s exact validation rules (required fields, `discovery_date` not in the future, `discovery_context` enum, `quantity >= 1`) means the resubmit form can reuse `views/ncr-create.jade`'s field layout and the route can reuse the same validation block already in `routes/ncr.js`'s `POST /` handler, rather than inventing a second set of rules for the same data.

## D7: Permission checks

**Decision**:
- `rejectConcurrence`: same `isQaStaffMember(user.id)` check `submitConcurrence` already performs (403 if not QA staff), same `ncr.status !== 'Dispositioned'` guard (409 otherwise).
- `resubmitNcr`: same `ncr.originator_id !== user.id && ncr.originator_designate_id !== user.id` check `closeNcr` already performs (403 otherwise), guarded by `fsm.can('resubmit')` (409 if `ncr.status !== 'Rejected'`).

**Rationale**: Both are direct reuses of checks already written and tested elsewhere in `lib/ncr-service.js` for the same roles acting at a different point in the same NCR lifecycle — no new authorization concept is introduced.

## D8: State machine transition table

**Decision**: `lib/ncr-state-machine.js` becomes:

| Transition | From | To |
|---|---|---|
| `submitDisposition` | `Submitted` | `Dispositioned` |
| `concurNoApprovers` | `Dispositioned` | `Final Approval` |
| `concurWithApprovers` | `Dispositioned` | `Approval Requested` |
| `reject` | `Dispositioned` | `Rejected` |
| `resubmit` | `Rejected` | `Submitted` |
| `returnForComment` | `Approval Requested` | `Dispositioned` |
| `finalApprove` | `Approval Requested` | `Final Approval` |
| `close` | `Final Approval` | `Closed` |

**Rationale**: Purely additive — every existing transition (including spec 129's `returnForComment`/`finalApprove` fix) is untouched. `reject` sits alongside `concurNoApprovers`/`concurWithApprovers` as the third edge out of `Dispositioned`, matching FR-001/FR-004. `resubmit` is the single edge out of `Rejected`, matching FR-006/FR-007 (nothing else can legally fire while `Rejected`, since every other transition's `from` is a different status).

## D9: Surfaces that need to change for a new status to be usable

Enumerated so Phase 2 (`/speckit.tasks`) has a complete punch list; no new decisions beyond D1–D8, these are direct consequences:

| File | What changes |
|---|---|
| `views/ncr-concurrence.jade` | Add a "Reject with Comments" comment field + button alongside the existing "Concur" button; on click, `PATCH /concurrence` with `{ action: 'reject', comments }`. |
| `views/ncr-detail-body.jade` | New `canResubmit = ncr.status === 'Rejected' && (locals.userid === ncr.originator_id \|\| locals.userid === ncr.originator_designate_id)`, same shape as the existing `canClose`; add to the `#ncr-next-action` row's condition and buttons, linking to `/ncrs/:id/resubmit`. Surface the rejection comment (from the `qa.rejected` event or a new top-level field, see data-model.md) somewhere on the page so the Originator/Designate can see *why* before editing. |
| `views/ncr-resubmit.jade` *(new)* | Adapted from `views/ncr-create.jade`'s field layout; submits `PATCH /ncrs/:id/resubmit` instead of `POST /ncrs`. |
| `routes/ncr-view.js` | New `app.get('/ncrs/:id/resubmit', ...)` page route, same shape as the existing `/ncrs/:id/close` (redirect to the NCR detail page if `ncr.status !== 'Rejected'`). |
| `views/ncr-dashboard.jade` | Add a `Rejected` status card (`data-status='Rejected'`), its entry in the inline color map, and a `.count-Rejected` counter, matching the five existing statuses' pattern exactly. |

No change needed in `lib/ncr-pdf.js` (closure PDF generation only ever runs from `Final Approval`/`Closed`, never `Rejected`/`Submitted`) or in `utilities/routes.js`'s traveler-input gating logic (research.md's spec Edge Cases note this explicitly — a traveler-linked NCR being rejected is just another "not yet Closed" state from the traveler input's point of view, already handled today).
