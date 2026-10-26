# Implementation Plan: QA Reject with Comments

**Branch**: `130-qa-reject-ncr` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/130-qa-reject-ncr/spec.md`

## Summary

Today, `lib/ncr-service.js#submitConcurrence` only ever sends a `Dispositioned` NCR to `Final Approval` (no approvers) or `Approval Requested` (approvers designated) — there is no way for QA to kick a flawed NCR back to whoever can actually fix it. This plan adds a third decision at that same point: `rejectConcurrence`, reached via `PATCH /api/ncrs/:id/concurrence` with `action: "reject"` (mirroring how `PATCH /:id/approve` already dispatches on an `action` field), requiring a non-blank comment, moving the NCR into a new `Rejected` status via a new `reject` state-machine transition. While `Rejected`, only the Originator or Originator Designate may act, via a new `resubmitNcr` function and `PATCH /api/ncrs/:id/resubmit` endpoint (reusing a path spec 129 retired for an unrelated purpose), which lets them edit the same fields `POST /api/ncrs` already validates at creation and moves the NCR to `Submitted` via a new `resubmit` transition — re-triggering the exact CE/CS disposition-request email `createNcr` already sends, so the engineering disposition/QA concurrence cycle restarts from the top. Both transitions fire a notification: rejection notifies QA staff, the Originator, and the Designate (if any) in one email; resubmission reuses the existing disposition-request email verbatim. `specs/NCR-flow.md`'s diagram has already been updated (prior to this plan) to show the new `QA CONCURRENCE DECISION` three-way branch and the loop it creates back into `ENGINEERING DISPOSITION`.

## Technical Context

**Language/Version**: JavaScript, Node.js 18+ (unchanged)

**Primary Dependencies**: Express 4, Mongoose 7, `javascript-state-machine` (`lib/ncr-state-machine.js`), Pug/Jade (views) — no new dependency.

**Storage**: MongoDB via Mongoose. One additive value on `NCR_STATUSES` (`'Rejected'`), one additive value on `NCR_EVENT_TYPES` (`'ncr.resubmitted'` — `'qa.rejected'` already exists, unused, per research.md D2), and one new scalar field on the existing `Ncr` schema (`qa_rejection_comments: String`). No new collection, no migration script — every existing NCR is simply absent the new field until the first time it is rejected, same as every other optional field in this schema. See [data-model.md](data-model.md).

**Testing**: `test-unit/lib/ncr-service.test.js` (unit — new `rejectConcurrence`/`resubmitNcr` coverage, direct extension of the existing `submitConcurrence`/`closeNcr` test patterns) and `test-unit/lib/ncr-email.test.js` (unit — new `sendQaRejection` coverage) plus `e2e/us3-qa-concurrence-and-approver-coordination.spec.js` (new reject scenario; its existing `AS9` scenario asserting *no* rejection is possible must be rewritten, not left in place, since this feature makes it false) and `e2e/us-ncr-next-action-visibility.spec.js` (new `Rejected` → resubmit-button permission case, alongside the existing four). Pre-change pass counts captured in [baseline.txt](baseline.txt).

**Target Platform**: Browser, via the existing session-authenticated web app; the Basic-Auth REST API (port 3002) shares the same `lib/ncr-service.js` functions and is affected identically.

**Project Type**: Web application (server-rendered Pug/Jade + a parallel REST API), extending the existing single-repository layout.

**Performance Goals**: No new query or network round trip beyond what the equivalent existing actions (`submitConcurrence`, `createNcr`) already perform; `resubmitNcr` does one `findById` + one `save()`, same as `submitDisposition`.

**Constraints**: `PATCH /api/ncrs/:id/resubmit` is a path this codebase already removed once (spec 129, for an unrelated QA-side action) and is now reintroduced with a different shape and a different caller — not a breaking change to any currently-live behavior (the path has 404'd since spec 129 shipped), but called out explicitly in research.md D5 and the Constitution Check below so it doesn't read as an accidental revert. `'qa.rejected'` is already a reserved-but-unused value in `NCR_EVENT_TYPES`; this feature is what finally produces it (research.md D2).

**Scale/Scope**: `model/ncr.js` (1 status value, 1 event type, 1 schema field added), `lib/ncr-state-machine.js` (2 transitions added), `lib/ncr-service.js` (2 functions added: `rejectConcurrence`, `resubmitNcr`), `lib/ncr-email.js` (1 function added: `sendQaRejection`), `routes/ncr.js` (1 endpoint extended, 1 added), `routes/ncr-view.js` (1 page route added), four view files (one new, three modified). No new files except tests and the one new view.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Automated Testing | Pass (pending Phase 2) | `test-unit/lib/ncr-service.test.js` already has direct, heavy coverage of `submitConcurrence` and `closeNcr` (baseline: 156 passing) — `rejectConcurrence` and `resubmitNcr` extend those exact patterns, not new test infrastructure. Every FR in spec.md (reject only from `Dispositioned`, blank-comment refusal, permission checks on both new actions, notification recipients, CE/CS re-notification) gets a direct unit test per Core Principle I's "no untested code." `research.md` D9 and `contracts/api-qa-reject.md` identify exactly which existing e2e scenario (`AS9`) must be rewritten because this feature makes its current assertion false, not merely extended. |
| II. Code Quality and Consistency | Pass | Both new service functions reuse existing authorization checks verbatim (`isQaStaffMember` from `submitConcurrence`; the Originator/Designate check from `closeNcr` — research.md D7) rather than introducing a new permission concept. The new endpoint reuses `createNcr`'s exact field validation (research.md D6) instead of duplicating a second set of rules for the same data. All new logic lives in `lib/ncr-service.js`/`lib/ncr-email.js` (business logic), never in a route or view. |
| III. Security-First Architecture | Pass | `PATCH /:id/resubmit`'s request body is validated with the same required/format rules `POST /api/ncrs` already enforces before anything is written (no new validation surface, no loosening); the 403/409 guards on both new actions are checked before any field is read from the request body into the document. No secret, credential, or PII handling is introduced. |
| IV. Versioning & Breaking Changes | Pass | No existing endpoint shape changes for any caller that doesn't send the new `action: "reject"` field (contracts/api-qa-reject.md). Reintroducing `PATCH /:id/resubmit` is not a breaking change — the path has returned 404 since spec 129 and nothing can be relying on that 404 as intended behavior; still called out explicitly (research.md D5) so it's traceable in history rather than looking like an unexplained revert. |
| V. Documentation | Pass (pending implementation) | CLAUDE.md gets a 130 "Recent Changes" entry, following the same format as 121–129, explicitly noting the `/resubmit` path reuse. `research.md` documents the WHY behind each non-obvious decision (especially D2's reasoning for why the rejection event reuses the reserved `qa.rejected` value but the resubmission event does *not* reuse the legacy `qa.resubmitted` value). `specs/NCR-flow.md` was updated as the very first step of this feature, per the original request, before spec.md was written. |

**Gate result**: PASS. No violation requires an entry in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/130-qa-reject-ncr/
├── spec.md
├── plan.md                         # this file
├── research.md                     # Phase 0 decisions (D1-D9)
├── data-model.md                   # Phase 1: schema fields, state table
├── contracts/
│   └── api-qa-reject.md            # endpoint changes + new endpoint
├── quickstart.md
├── baseline.txt                    # pre-implementation test pass counts
├── checklists/requirements.md
└── tasks.md                        # created by /speckit.tasks
```

### Source Code (repository root)

```text
model/
└── ncr.js                 # NCR_STATUSES: + 'Rejected'
                            # NCR_EVENT_TYPES: + 'ncr.resubmitted' ('qa.rejected' already present)
                            # NcrSchema: + qa_rejection_comments (String)

lib/
├── ncr-state-machine.js    # + reject: Dispositioned -> Rejected
                            # + resubmit: Rejected -> Submitted
├── ncr-service.js          # + rejectConcurrence(ncrId, comments, user, webBaseUrl)
                            #     same isQaStaffMember + status guard as submitConcurrence;
                            #     sets qa_staff_identity/name/timestamp, qa_rejection_comments;
                            #     pushes qa.rejected event; sends sendQaRejection to QA+Originator+Designate
                            # + resubmitNcr(ncrId, data, user, webBaseUrl)
                            #     same Originator/Designate guard as closeNcr; same field
                            #     validation as createNcr; overwrites editable fields;
                            #     pushes ncr.resubmitted event; sends sendDispositionRequest
                            #     (existing) to ce_cs_email, logs notification.disposition_request
└── ncr-email.js            # + sendQaRejection(ncr, recipients, comments, ncrUrl)
                            #     same sendToRecipients "everyone on one to: line" shape as
                            #     sendInitialNotification

routes/
├── ncr.js                  # PATCH /:id/concurrence: + action: 'reject' branch (require
                            #   comments, call rejectConcurrence) alongside existing dispatch
                            # + PATCH /:id/resubmit (validate body like POST /, call resubmitNcr)
└── ncr-view.js             # + GET /ncrs/:id/resubmit (redirect to detail page unless
                            #   ncr.status === 'Rejected', else render ncr-resubmit)

views/
├── ncr-concurrence.jade    # + comment field + "Reject with Comments" button, alongside
                            #   the existing "Concur" button
├── ncr-resubmit.jade       # NEW — adapted from ncr-create.jade's field layout; submits
                            #   PATCH /ncrs/:id/resubmit
├── ncr-detail-body.jade    # + canResubmit (same shape as canClose); add to #ncr-next-action
                            #   row; surface ncr.qa_rejection_comments when status is Rejected
└── ncr-dashboard.jade      # + Rejected status card, color-map entry, .count-Rejected

test-unit/lib/
├── ncr-service.test.js     # + rejectConcurrence, resubmitNcr coverage (success, 403, 409,
                            #   blank-comment validation, notification dispatch)
└── ncr-email.test.js       # + sendQaRejection coverage (recipients, comment/link in body,
                            #   no designate in recipients when none assigned)

e2e/
├── us3-qa-concurrence-and-approver-coordination.spec.js   # rewrite AS9 (today asserts no
                            #   rejection is possible); add a reject-with-comments scenario
                            #   and a resubmit scenario
└── us-ncr-next-action-visibility.spec.js                  # add the Rejected -> resubmit-button
                            #   permission case alongside the existing four
```

**Structure Decision**: No new project, module, or view directory — this is a behavior
extension entirely within the existing single-repository web app. One model
file, one state-machine file, one service file, one email file, two route
files, and four view files (one new) are touched. No deletions — unlike
spec 129, nothing this feature replaces becomes dead code.

## Phase 0 and Phase 1 outputs

- [research.md](research.md): decisions D1-D9 — how the new status and its
  two event types are represented, why the rejection event reuses the
  already-reserved `qa.rejected` value but the resubmission event does not
  reuse the legacy `qa.resubmitted` value, the endpoint design (extend
  `/concurrence`, reuse the retired `/resubmit` path for an unrelated new
  purpose), the editable-field set on resubmission, the reused permission
  checks, the full new state transition table, and the complete list of
  view/route surfaces that need a `Rejected`-aware branch.
- [data-model.md](data-model.md): the new status value, the new schema
  field and event types, and the post-change state table.
- [contracts/api-qa-reject.md](contracts/api-qa-reject.md): the exact
  request/response-shape impact (additive on `/concurrence`, new on
  `/resubmit`) of both endpoints.
- [quickstart.md](quickstart.md): a by-hand walkthrough of reject →
  resubmit → normal cycle resumes, plus the automated commands to run and
  where baseline pass counts live.

## Complexity Tracking

*(none — Constitution Check passed with no violations)*
