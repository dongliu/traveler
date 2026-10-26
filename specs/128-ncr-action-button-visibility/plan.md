# Implementation Plan: Reposition and Permission-Gate the NCR Next-Action Button

**Branch**: `128-ncr-action-button-visibility` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/128-ncr-action-button-visibility/spec.md`

## Summary

`views/ncr-detail-body.jade`'s `.span4.text-right` block (top of the page,
beside the NCR number) always shows the NCR's next-action button to
*every* viewer whenever the status offers one, regardless of whether that
viewer can actually perform it. This is a pure view-layer fix: the
template already receives everything needed to decide both where to put
the button and who should see it — `isQa` and `ncr` (with
`ce_cs_id`/`additional_approvers`/`originator_id`/`originator_designate_id`)
are already passed to this template by both routes that render it
(`GET /ncrs/:id` and `GET /ncrs/:id/fragment`, `routes/ncr-view.js`), and
`locals.userid` is set globally for every authenticated request
(`lib/auth/ldap.js`). No route, service, or model change is needed. Four
boolean checks — one per action, each mirroring exactly the authorization
`lib/ncr-service.js` already enforces when that action is submitted
(`submitDisposition`, `submitConcurrence`, `submitApproval`, `closeNcr`) —
replace the current bare `if ncr.status === '...'` checks, and the whole
button block moves from the top header row to a new row directly above
Event Timeline.

## Technical Context

**Language/Version**: JavaScript, Node.js 18+ (unchanged)

**Primary Dependencies**: Express 4, Pug/Jade (views) — no new dependency.

**Storage**: MongoDB via Mongoose — no schema change, no new query. The
authorization checks read fields (`ce_cs_id`, `additional_approvers`,
`originator_id`, `originator_designate_id`) already present on the `ncr`
object the template already receives.

**Testing**: No existing unit-test precedent targets `views/*.jade` files
directly in this codebase (Jade template logic isn't unit-tested
anywhere); the constitution's own testing levels put this kind of
rendered-page behavior under e2e. A new Playwright spec drives the real
NCR detail page as different personas/roles and asserts button
position/visibility — the only existing e2e coverage anywhere near this
area (`e2e/us3-qa-concurrence-and-approver-coordination.spec.js`) never
asserted on these specific buttons, so nothing existing needs updating,
only new coverage added.

**Target Platform**: Browser (existing NCR detail page), reached through
the existing session-authenticated web app.

**Project Type**: Web application (server-rendered Pug/Jade pages),
extending the existing single-repository layout.

**Performance Goals**: No new query or network round trip — the four
authorization checks are in-memory boolean comparisons against data the
template already has.

**Constraints**: Must not change which NCR statuses offer a next action,
which action each offers, or which page each action's button links to
(FR-002) — only the button's position and who sees it. Must not weaken
any actual authorization (the dedicated action pages — disposition,
concurrence, approval, close — already enforce their own checks server-side
and are unchanged by this feature); this only makes the *button's
visibility* match what was already true.

**Scale/Scope**: One view file (`views/ncr-detail-body.jade`). Both
routes that render it (`GET /ncrs/:id`, `GET /ncrs/:id/fragment`) already
pass what's needed — no route change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against `.specify/memory/constitution.md` v1.1.0.

| Principle | Status | How this plan meets it |
|---|---|---|
| I. Automated Testing | Pass | New Playwright e2e coverage (no existing unit-test precedent applies to Jade view logic in this codebase) drives the real page as an authorized viewer, an unauthorized viewer, and (for QA Concurrence) a QA-staff viewer, asserting both the button's new position and its presence/absence. |
| II. Code Quality and Consistency | Pass | The four authorization booleans are declared once, near the existing `canManageApprovers` declaration at the top of the same file (same convention already established there), not duplicated inline at each `if`. |
| III. Security-First Architecture | Pass | This feature narrows what's *shown*, never what's *allowed* — the dedicated action pages already enforce their own authorization server-side and are untouched. Each new boolean is a read of already-authorized-to-view data (the viewer's own session id against fields on an NCR they already have access to view), not a new access-control surface. |
| IV. Versioning & Breaking Changes | Pass | Purely additive/corrective within one view file; no endpoint request/response shape changes, no field removed. |
| V. Documentation | Pass | CLAUDE.md gets a 128 "Recent Changes" entry once implemented. |

**Gate result**: PASS. No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/128-ncr-action-button-visibility/
├── spec.md
├── plan.md                      # this file
├── research.md                  # Phase 0 decisions
├── data-model.md                # Phase 1: the four authorization booleans
├── checklists/requirements.md
└── tasks.md                     # created by /speckit.tasks
```

No `contracts/` directory — this feature changes no endpoint, request, or
response shape; there is no interface contract to document.

### Source Code (repository root)

```text
views/
└── ncr-detail-body.jade    # top: four new `can*` booleans declared alongside
                              #   the existing `canManageApprovers` (line 1)
                              # .row-fluid > .span4.text-right block (top, beside
                              #   the NCR number) removed
                              # new .row-fluid > .span12 block, left-aligned,
                              #   inserted immediately before the Event Timeline
                              #   .row-fluid, gated on the matching `can*` boolean

e2e/
└── us-ncr-next-action-visibility.spec.js   # NEW
```

**Structure Decision**: Single-file view change; no new route, no new
client-side script, no schema migration. One new e2e spec file.

## Phase 0 and Phase 1 outputs

- [research.md](research.md): the two decisions behind this plan — reusing
  already-available template locals instead of adding new route logic,
  and mirroring the service layer's existing authorization exactly rather
  than inventing new rules.
- [data-model.md](data-model.md): the four `can*` booleans — their exact
  condition, and the service-layer check each one mirrors.
- [quickstart.md](quickstart.md): how to verify by hand and by e2e.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

*(none — Constitution Check passed with no violations)*
