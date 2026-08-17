# Implementation Plan: NCR Originator Designate Assignment

**Branch**: `003-originator-designate` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-originator-designate/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add the ability for an NCR's Originator to assign exactly one other user as
that NCR's Designate, who then holds the same authority the Originator has on
that specific NCR (viewing/dashboard visibility, receiving the ISSUANCE and
FINAL NCR DISTRIBUTION emails, and closing the NCR — with their own identity
recorded, not the Originator's). This closes a gap `specs/001-ncr-workflow/spec.md`
already assumed existed ("NCR Originator or designee" appears in five places)
but never actually specified or built. Research found the codebase already
anticipated this exact shape: `ce_cs_delegate_id` was a working, already-wired
permission check for an analogous CE/CS delegate concept that nothing ever
set, and `NCR_EVENT_TYPES` already reserves a `delegate.assigned` event type
that nothing ever pushed. This feature followed that same established pattern
for the Originator side rather than introducing a new mechanism. (`ce_cs_delegate_id`
itself was subsequently removed once CE/CS delegation was formally ruled out
— see `specs/001-ncr-workflow/spec.md`'s "Resolved: CE/CS Delegate
Assignment" — but the pattern it established lives on as this feature's own
`originator_designate_id`.)

## Technical Context

**Language/Version**: JavaScript (Node.js 18+) — unchanged, extends the existing app

**Primary Dependencies**: None new — reuses Express/Mongoose/Nodemailer and the existing `travelerGlobal.usernames` Bloodhound typeahead already used for CE/CS selection on NCR creation (research.md Decision 4)

**Storage**: MongoDB via Mongoose — two additive fields (`originator_designate_id`, `originator_designate_name`) on the existing `Ncr` schema plus one new `NCR_EVENT_TYPES` enum value (`delegate.removed`; `delegate.assigned` already exists, unused); no new collection, no migration needed since the fields are optional and absent by default on every existing document

**Testing**: `test-unit/lib/ncr-service.test.js` (Mocha/Sinon/Chai, existing file — new `describe` blocks) for unit coverage; a new Playwright spec file under `e2e/` (reusing the fixture CLI and Mailpit client already built for `specs/002-playwright-e2e-tests`) for end-to-end coverage

**Target Platform**: Same existing web-service (Express web + API servers, `app.js`)

**Project Type**: Extension to the existing NCR workflow module — not a new deployable

**Performance Goals**: N/A beyond the existing NCR module's — adds simple field reads/writes to already-loaded documents, no new query patterns

**Constraints**: Every permission and visibility check MUST be enforced server-side in `lib/ncr-service.js` (never only in the view layer) — consistent with the app's existing security posture and directly load-bearing for spec.md SC-003 (0% of non-Originator assignment attempts succeed)

**Scale/Scope**: 2 user stories / 11 acceptance scenarios; touches `model/ncr.js`, `lib/ncr-service.js` (4 existing call sites widened + 2 new functions), `lib/ncr-email.js` (1 new notification function), `routes/ncr.js` (1 new route), `views/ncr-detail.jade` (display + assignment UI)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Evaluation

| Principle | Status | Notes |
|---|---|---|
| I. Automated Testing | PASS | New unit tests in the existing `test-unit/lib/ncr-service.test.js`; new e2e coverage in `e2e/`, reusing already-built Playwright infrastructure. |
| II. Code Quality and Consistency | PASS | Follows the codebase's own existing `ce_cs_delegate_id`/`isQaStaffMember`-adjacent patterns exactly (research.md Decisions 1, 5); no new architectural layer introduced. |
| III. Security-First Architecture | PASS | The core of this feature *is* an authorization boundary (who may assign, who may act as Designate) — every check is added at the service layer (`lib/ncr-service.js`), never only in `routes/ncr.js` or the view, matching the Technical Context constraint above. Self-assignment and Closed-NCR-status locks (FR-003, FR-005) are both enforced server-side. |
| IV. Versioning & Breaking Changes | PASS | Purely additive schema fields; existing NCR documents and existing behavior for NCRs with no Designate are unaffected. |
| V. Documentation | PASS | `contracts/ncr-designate.json` documents the new endpoint in the same JSON-contract format `specs/001-ncr-workflow/contracts/` already established. |

No gate violations. No complexity tracking required.

### Post-Design Re-check

| Principle | Status | Notes |
|---|---|---|
| I. Automated Testing | PASS | data-model.md's two new service functions (`assignDesignate`, `removeDesignate`) and the four widened call sites are each independently unit-testable following the existing file's `describe`-per-function convention. |
| II. Code Quality and Consistency | PASS | data-model.md confirms no new collection, no new cross-cutting helper — four call sites is small enough that inline checks (matching the `ce_cs_delegate_id` precedent) stay more consistent than adding indirection (research.md Decision 5's alternative was explicitly rejected). |
| III. Security-First Architecture | PASS | contracts/ncr-designate.json's authorization line is unambiguous and matches FR-002 exactly; the 400-not-403 distinction for self-assignment (a request-shape error, not an authorization failure) is documented explicitly to avoid an implementation ambiguity. |
| IV. Versioning & Breaking Changes | PASS | No change since pre-design. |
| V. Documentation | PASS | All Phase 1 artifacts produced (data-model.md, contracts/ncr-designate.json, quickstart.md). |

No gate violations after design. No complexity tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/003-originator-designate/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── ncr-designate.json
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
model/
└── ncr.js                # MODIFIED — add originator_designate_id, originator_designate_name fields; add 'delegate.removed' to NCR_EVENT_TYPES (data-model.md)

lib/
├── ncr-service.js         # MODIFIED — new assignDesignate()/removeDesignate() functions; widen 4 existing call sites (closeNcr permission check, issuance-recipient building x2, final-distribution recipients, buildRoleScope + getNcrById visibility scope) (data-model.md)
└── ncr-email.js            # MODIFIED — new sendDesignateAssigned(ncr, designate) notification function, following the existing sendPaAssigned()-style single-recipient pattern

routes/
└── ncr.js                 # MODIFIED — new PATCH /:id/designate route (contracts/ncr-designate.json)

views/
└── ncr-detail.jade         # MODIFIED — display current Designate in the Reference section; Originator-only assign/change/remove control reusing the existing CE/CS typeahead pattern (research.md Decision 4)

test-unit/lib/
└── ncr-service.test.js     # MODIFIED — new describe blocks for assignDesignate/removeDesignate; updated assertions on closeNcr, buildRoleScope, issuance/final-distribution recipient building

e2e/
└── us-originator-designate.spec.js   # NEW — Playwright coverage of both user stories, reusing e2e/fixtures/{env,exec-cli,mailpit,auth-state,run-id}.js from specs/002-playwright-e2e-tests
```

No new top-level directories and no new dependencies — this is a scoped
extension of the existing NCR module along exactly the seams the module
already has (per-NCR secondary-identity fields, service-layer permission
checks, notification functions, one new route).

**Structure Decision**: Modify the existing NCR module's files in place,
following each file's own established internal conventions exactly (research.md
Decisions 1, 2, 3, 5) rather than introducing a separate "designate" module —
this is a small, tightly-scoped capability that belongs alongside the
already-analogous CE/CS delegate plumbing it reuses the shape of.

## Complexity Tracking

*No Constitution Check violations — this section is not applicable.*
