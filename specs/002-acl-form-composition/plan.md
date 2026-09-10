# Implementation Plan: ACL Form Composition on Release

**Branch**: `002-acl-form-composition` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-acl-form-composition/spec.md`

## Summary

Add a new "ACL" form type that follows the existing draft → review → release lifecycle, and add a
new **compose** action — distinct from and mutually exclusive with today's release-with-discrepancy
action — that lets an authorized user (Manager/Admin) bundle one already-released base form with
zero, one, or multiple already-released ACL forms into a new released form. Duplicate compositions
are detected by comparing the exact set of source released-form ids (base id + sorted ACL ids)
rather than by concatenating version numbers, which sidesteps the collision problem the naive
`base_v[:discrepancy_v]` scheme would have with a variable-length ACL set. Travelers created from a
composed released form render every attached ACL form's fields inline at the top of the traveler,
ahead of the base form, reusing the existing single-`#form`-container input/save/validation
machinery rather than the separate discrepancy-log popup mechanism.

## Technical Context

**Language/Version**: Node.js (CommonJS), matching the existing Express 4.17 / Mongoose 5.13 stack — no version change.

**Primary Dependencies**: Express 4.x (`app`/`api` servers), Mongoose 5.x, Jade 1.x templates, cheerio (server-side HTML parsing of form markup), jQuery 3.7 + Bootstrap 2 + DataTables (client). No new dependencies are introduced.

**Storage**: MongoDB via Mongoose — extends the existing `Form` and `ReleasedForm` schemas and adds one array field to `Traveler`; no new collections.

**Testing**: Mocha, per existing convention (`test/lib/*-test.js`) for new `lib/` helper functions (e.g., a composition-duplicate/version helper if one is extracted). The repository has no existing route- or view-level automated tests; route and UI behavior is validated manually via `quickstart.md`, consistent with current practice for the sibling `discrepancy` feature.

**Target Platform**: Existing two-server Node.js deployment (session-authenticated web app + basic-auth REST API), browser clients (no build step, per Constitution Principle V). This feature is web-app-only — it does not touch `routes/api.js`, mirroring how the existing discrepancy feature has no REST API surface either.

**Project Type**: Web application (single repository, `routes/` + `model/` + `views/` + `public/javascripts/`).

**Performance Goals**: No new performance targets; composition and traveler rendering must stay within the existing perceived response time of today's release/traveler-load actions (sub-second for typical single-digit ACL-form counts).

**Constraints**: No build pipeline; no new npm dependencies; must not alter the REST API's backward compatibility (Principle III); all entity mutations that are audit-relevant must use `saveWithHistory(userid)` (per constitution's Development Workflow).

**Scale/Scope**: Single internal lab tool; ACL form counts per composition are small, human-curated selections (no enforced upper bound per spec, but no batch/bulk-scale concerns).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Lifecycle State Machine (NON-NEGOTIABLE)** — PASS. "ACL" is a new `formType` value on the existing `Form`/`ReleasedForm` state machines (`stateTransition`); no new state machine is introduced, and no code bypasses `stateTransition`-validated transitions. The compose action produces a new `ReleasedForm` document that starts directly at `status = 1` (released), exactly like today's `releaseForm` handler already does for the discrepancy path — not a new transition, just a new creation path with the same target state.
- **II. Permission-Layered Access Control** — PASS, with one note. The compose route uses `req-utils.js` factories (`reqUtils.exist`, `reqUtils.canReadMw`) for existence/read checks on the selected source forms, plus the already-precedented `auth.requireRoles(condition, ...roles)` factory (used today at `routes/form.js:848` to restrict discrepancy-form creation to admins) to gate the compose action itself to Manager/Admin. This keeps the check centralized in shared middleware rather than inline in the handler body, consistent with the principle's intent, even though `auth.requireRoles` lives in `lib/auth.js` rather than `lib/req-utils.js`.
- **III. Two-Server Separation** — PASS. All new routes are added to the web app's route files (`routes/form.js` and/or `routes/form-management.js`); `routes/api.js` is untouched.
- **IV. Composable Model Features** — PASS. No new cross-cutting mixin is needed; the feature reuses the existing `addHistory`/`addVersion`/`addReview` mixins already applied to `Form` and `ReleasedForm`.
- **V. Minimal, Build-Free Frontend** — PASS. New UI is jQuery + Bootstrap + DataTables, following the existing `form-builder.js` multi-select table pattern (`selectMultiEvent`, `fnGetSelectedInPage`) already used for the "prior versions to archive" picker. No bundler, no framework.

No violations requiring the Complexity Tracking table.

### Post-Design Re-Check

Re-evaluated after Phase 1 (`data-model.md`, `contracts/`, `quickstart.md`): the finalized design —
new `formType` enum values on existing schemas, an `aclForms` snapshot array on `ReleasedForm`
mirroring `discrepancy`, a `ver` string still produced by the same `title+formType+ver+status`
duplicate lookup, and a new `Traveler.aclForms` array rendered inside the existing `#form` container
— introduces no new state machine, no inline permission checks, no REST API changes, no new
cross-cutting mixin, and no build tooling. All five gates above still PASS; no complexity-tracking
entries are needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-acl-form-composition/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
model/
├── form.js                      # add 'ACL' to formType enum (draft/review lifecycle, unchanged otherwise)
├── released-form.js             # add 'ACL' + 'normal_acl' formType values, add aclForms: [formContent] field
└── traveler.js                  # add aclForms: [form] array field (rendered/fillable, unlike single-active discrepancyForms)

routes/
├── form.js                      # unchanged discrepancy release path; formType='ACL' reuses existing POST /forms/ creation + review + release-without-discrepancy flow
├── form-management.js           # + POST /released-forms/:id/compose (compose action), + GET /released-forms/acl/json (ACL picker listing)
└── traveler.js                  # extend traveler-creation formType allow-list to accept 'normal_acl'; extend data-submission progress accounting to include ACL labels

utilities/
└── routes.js                    # extend createTraveler/addBase-equivalent init and resetTouched to merge ACL form labels/mapping/types into traveler-level totals

views/
├── released-form.jade           # render attached ACL forms alongside base/discrepancy; add "Compose" entry point for Manager/Admin on a 'normal' released form
├── released-form-compose.jade   # new: base (single-select) + ACL (multi-select) picker, mirrors form-builder.js's prior-versions table pattern
└── traveler.jade                # render each attached ACL form's HTML in its own labeled section, prepended above the base form's section, inside the same #form container

public/javascripts/
├── released-form-management.js  # extend or add compose-picker wiring (DataTables multi-select, submit to compose endpoint)
└── traveler.js                  # no functional change expected — existing #form-scoped input listeners already cover any markup rendered inside #form

test/lib/
└── (new/updated *-test.js as needed for any extracted composition/duplicate-key helper)
```

**Structure Decision**: Single Express repository, extending existing `model/`, `routes/`, `utilities/`, `views/`, and `public/javascripts/` directories in place — no new top-level modules or projects. This mirrors exactly how the existing `discrepancy` form type is implemented (same files, same layering), per Constitution Principle IV (composable model features, no duplicated logic) and Principle V (no build step).

## Complexity Tracking

*No Constitution Check violations — table intentionally omitted.*
