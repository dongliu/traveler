# Implementation Plan: NCR Approval Rounds

**Branch**: `129-ncr-approval-round` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/129-ncr-approval-round/spec.md`

## Summary

`lib/ncr-state-machine.js` currently lets a single approver's "Return for Comment" decision block the whole NCR in a `Returned for Comment` status that only resumes the *same* approval round (via `qaResubmit`/`resubmitToApprovers`), and — because `finalApprove` is wired `from: ['Approval Requested', 'Returned for Comment']` — a blocked round can reach `Final Approval` anyway if the blocking approver is removed (`removeApprover`'s `unblock`/`maybeFinalApprove` interplay), without ever resolving the return-for-comment. This plan replaces that with an explicit **approval round** concept: `ncr.current_approval_round` (a new counter) plus a `round` tag on each approval-related event. A "Return for Comment" decision now stops the round outright and sends the NCR directly back to `Dispositioned` (the `Returned for Comment` NCR status is removed entirely); `Final Approval` is reachable only via `finalApprove` firing from `Approval Requested`, gated by every current-round approver being `Approved` — there is no other edge into it from the approval sub-flow. Starting a new round after a stop reuses the existing `submitConcurrence` action (no new endpoint); the now-impossible "resubmit the same round" path (`qaResubmit`, its route, and the `unblock` transition) is deleted as dead code.

## Technical Context

**Language/Version**: JavaScript, Node.js 18+ (unchanged)

**Primary Dependencies**: Express 4, Mongoose 7, `javascript-state-machine` (`lib/ncr-state-machine.js`), Pug/Jade (views) — no new dependency.

**Storage**: MongoDB via Mongoose. One additive field on the existing `Ncr` schema (`current_approval_round: Number`) and one additive field on its embedded event schema (`events[].round: Number`); one enum value removed from `NCR_STATUSES` (`'Returned for Comment'`). No new collection. No migration script — per the resolved clarification, no NCR in any environment that matters is currently persisted with `status: 'Returned for Comment'`, so no backfill is needed. See [data-model.md](data-model.md).

**Testing**: `test-unit/lib/ncr-service.test.js` (unit, direct coverage of every function this feature changes or removes — `submitConcurrence`, `submitApproval`, `returnForComment`, `qaResubmit`, `addApprover`, `removeApprover`, `maybeFinalApprove`) plus `e2e/us3-qa-concurrence-and-approver-coordination.spec.js` and `e2e/us-ncr-next-action-visibility.spec.js` (both have scenarios that directly exercise or construct the `Returned for Comment` status and must be updated, not just extended). Pre-change pass counts captured in [baseline.txt](baseline.txt).

**Target Platform**: Browser, via the existing session-authenticated web app; the Basic-Auth REST API (port 3002) shares the same `lib/ncr-service.js` functions and is affected identically.

**Project Type**: Web application (server-rendered Pug/Jade + a parallel REST API), extending the existing single-repository layout.

**Performance Goals**: No new query or network round trip; `current_approval_round` is a plain field read/written alongside fields the affected functions already load and save.

**Constraints**: Removing `PATCH /api/ncrs/:id/resubmit` is a breaking REST API change (endpoint disappears, 404 after removal) — see [contracts/api-approval-round.md](contracts/api-approval-round.md) and the Constitution Check below. Historical `events[].event_type` values that are no longer produced (`'qa.resubmitted'`) must stay in the `NCR_EVENT_TYPES` enum rather than being removed, or saving any pre-existing NCR whose history already contains one would start failing Mongoose's full-document validation (see research.md D3).

**Scale/Scope**: `model/ncr.js` (2 new fields, 1 enum value removed), `lib/ncr-state-machine.js` (2 transitions removed, 1 retargeted), `lib/ncr-service.js` (one function deleted, four modified), `routes/ncr.js` (one route deleted), three view files, one email body string. No new files except tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Automated Testing | Pass (pending Phase 2) | `test-unit/lib/ncr-service.test.js` already has direct, heavy coverage of every touched function (baseline: 158 passing) and will be extended/corrected, not replaced, by `/speckit.tasks`; every behavior change in this plan (round-stop target, decision finality, round numbering, dead-code removal) gets a regression test per Core Principle I's "every bug fix MUST include a regression test." `research.md` D4 and `contracts/api-approval-round.md` enumerate exactly which existing e2e scenarios (AS7 resubmit, the Returned-for-Comment approver-management scenario, the next-action-visibility "no button" scenario) must be rewritten rather than left to rot against removed behavior. |
| II. Code Quality and Consistency | Pass | Dead code (`qaResubmit`, its route, `resubmitToApprovers`/`unblock`, the `wasBlocking` branch) is deleted rather than left unreachable (research.md D4) — directly serving "avoid code duplication/unused complexity." The round concept stays in `lib/ncr-service.js` and `model/ncr.js` (business logic / data model), never in a route or view, matching the existing separation of concerns. |
| III. Security-First Architecture | Pass | No new input-validation surface: the one new field (`current_approval_round`) is system-written only, never accepted from a request body. No authorization check is loosened; `addApprover`/`removeApprover`'s allowed-status window only *narrows* (drops the now-unreachable `'Returned for Comment'` branch). |
| IV. Versioning & Breaking Changes | Pass, with a called-out breaking change | `PATCH /api/ncrs/:id/resubmit` is removed outright rather than deprecated-then-removed, because the state it served (`Returned for Comment`) stops being reachable the moment this ships — there is no transition period in which both old and new behavior can coexist. This is communicated the same way the precedent in `specs/007-wbs-yaml-config` was: a CLAUDE.md "Recent Changes" entry on implementation, plus `contracts/api-approval-round.md` here. All other endpoint shapes are unchanged or purely additive (`events[].round`). |
| V. Documentation | Pass (pending implementation) | CLAUDE.md gets a 129 "Recent Changes" entry, following the same format as 121–128, including the breaking-change note. `research.md` documents the WHY behind each non-obvious decision (especially D3's Mongoose full-document-validation rationale, which is exactly the kind of non-obvious intent Principle V asks to be captured). |

**Gate result**: PASS. The one violation-shaped item (removing an endpoint with no deprecation window) is justified above rather than entered in Complexity Tracking, since Complexity Tracking is for structural complexity (extra projects/patterns), not for a called-out breaking change that the Constitution's own Principle IV explicitly anticipates and asks to be "clearly communicated."

## Project Structure

### Documentation (this feature)

```text
specs/129-ncr-approval-round/
├── spec.md
├── plan.md                         # this file
├── research.md                     # Phase 0 decisions (D1-D8)
├── data-model.md                   # Phase 1: schema fields, state table
├── contracts/
│   └── api-approval-round.md       # endpoint behavior changes + removal
├── quickstart.md
├── baseline.txt                    # pre-implementation test pass counts
├── checklists/requirements.md
└── tasks.md                        # created by /speckit.tasks
```

### Source Code (repository root)

```text
model/
└── ncr.js                 # NCR_STATUSES: remove 'Returned for Comment'
                            # NcrSchema: + current_approval_round (Number)
                            # NcrEventSchema: + round (Number)
                            # additional_approvers[].approval_status enum: unchanged

lib/
├── ncr-state-machine.js    # remove resubmitToApprovers, unblock;
                            #   returnForComment: Approval Requested -> Dispositioned
                            #   finalApprove: from Approval Requested only
├── ncr-service.js          # submitConcurrence: set/increment current_approval_round;
                            #   tag qa.concurred/approvers.designated/
                            #   notification.approval_request events with round
                            # submitApproval / returnForComment: tag approval.approved /
                            #   approval.returned_for_comment events with round;
                            #   returnForComment: decision-finality guard (D5),
                            #   fsm target Dispositioned (not Returned for Comment)
                            # qaResubmit: DELETED
                            # addApprover / removeApprover: PRE_ISSUANCE_STATUSES ->
                            #   ['Approval Requested'] only; remove wasBlocking/unblock
                            #   branch in removeApprover; tag their events with round
                            # POST_DISPOSITION_STATUSES: remove 'Returned for Comment'
└── ncr-email.js            # sendQaNotification's returned_for_comment body copy:
                            #   reword "resubmit to approvers" (no longer a real action)

routes/
└── ncr.js                  # DELETE PATCH /:id/resubmit

views/
├── ncr-approval.jade       # remove isReturnedForComment; canManageApprovers ->
                            #   isQa && status === 'Approval Requested'; remove the
                            #   "QA Action / Resubmit to Approvers" fieldset + JS handler
├── ncr-detail-body.jade    # canManageApprovers -> same narrowing; Event Timeline
                            #   partial: render event.round when present
└── ncr-dashboard.jade      # remove the Returned for Comment status card, its entry
                            #   in the status-color map, and .count-Returned

test-unit/lib/
└── ncr-service.test.js     # update/replace scenarios built around Returned for
                            #   Comment, qaResubmit, and the unblock/wasBlocking path;
                            #   add round-numbering and decision-finality coverage

e2e/
├── us3-qa-concurrence-and-approver-coordination.spec.js   # rewrite AS7 (resubmit) and
                            #   the "Returned for Comment" approver-management scenario
└── us-ncr-next-action-visibility.spec.js                  # the scenario that constructs
                            #   an NCR directly in Returned for Comment status needs a
                            #   different fixture status (that one is now unreachable)
```

**Structure Decision**: No new project, module, or view — this is a behavior
change entirely within the existing single-repository web app. One model
file, one state-machine file, one service file, one route file, three view
files, and one email-copy string are modified; one service function and one
route are deleted. No new directories.

## Phase 0 and Phase 1 outputs

- [research.md](research.md): decisions D1-D8 — how the round concept is
  represented, why `Returned for Comment` can be dropped from `NCR_STATUSES`
  but `'qa.resubmitted'` must stay in `NCR_EVENT_TYPES`, the full new state
  transition table, and the complete list of view/email surfaces that read
  the removed status today.
- [data-model.md](data-model.md): the two new schema fields, the unchanged
  `additional_approvers` shape, and the post-change state table.
- [contracts/api-approval-round.md](contracts/api-approval-round.md): the
  exact request/response-shape impact (none) and behavior impact (several)
  on `/approve`, `/concurrence`, `/approvers`, plus the removal of
  `/resubmit`.
- [quickstart.md](quickstart.md): a by-hand walkthrough across two rounds,
  plus the automated commands to run and where baseline pass counts live.

## Complexity Tracking

*(none — Constitution Check passed; the one breaking change, endpoint
removal with no deprecation window, is justified in the Constitution Check
table above, not here, since it is not structural complexity)*
