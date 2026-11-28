# Implementation Plan: Backfill Traveler Classification Metadata

**Branch**: `008-backfill-traveler-metadata` | **Date**: 2026-11-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-backfill-traveler-metadata/spec.md`

## Summary

When an owner or admin updates a released form's `subsystem`, `device`, or `activity` via the existing `PUT /released-forms/:id/metadata` endpoint, the server now also finds every `Traveler` created from that exact released form (matched by `referenceReleasedForm` id **and** `referenceReleasedFormVer`) and, for each of the three classification fields independently, fills in the traveler's value if it is currently blank and the released form's new value is not. Values a traveler already has are never overwritten, and travelers tied to any other released form or version are never touched. The backfill runs synchronously in the same request, has no effect on traveler lifecycle state, and creates no traveler-side history entry (none exists today; that remains deferred per the spec).

No new fields, models, or routes. The only new code is a small, independently testable `lib/` helper invoked from the one existing route that already edits this data.

## Technical Context

**Language/Version**: Node.js (project's current version); Express 4.x

**Primary Dependencies**: Mongoose (query + save on existing `Traveler`/`ReleasedForm` models); no new npm dependencies

**Storage**: MongoDB via Mongoose — no schema changes, no migration; reads/writes existing fields only

**Testing**: Mocha — new unit tests in `test/lib/` for the new `lib/` helper; existing `test/lib/req-utils-test.js`-style smoke coverage for the modified route's response shape

**Target Platform**: Web server (session-authenticated browser UI) — the modified endpoint is on the web app, not the REST API

**Project Type**: Web application — behavior change to an existing Jade-UI-facing route; no REST API (`routes/api.js`) changes

**Performance Goals**: No new performance target beyond SC-004 ("no noticeable increase in wait time"); expected traveler-per-released-form counts are small for this system, so a straightforward find-then-save loop is sufficient (see [research.md](research.md) §3)

**Constraints**: No build pipeline; no new dependencies; must not introduce a traveler-side history/audit entry (explicit scope boundary from the spec)

**Scale/Scope**: Touches 1 route handler (`routes/form-management.js`), adds 1 new `lib/` file, adds 1 new `test/lib/` file. No model, view, or frontend JS changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Lifecycle State Machine | ✅ Pass | No `status`/`stateTransition` field on either model is read or written. The backfill touches only `subsystem`/`device`/`activity`, and FR-005 explicitly makes it apply regardless of the traveler's lifecycle state — but that state field itself is never inspected or changed, so there is no bypass of a validated transition. |
| II. Permission-Layered Access Control | ✅ Pass | No new route and no new permission surface. The only entry point remains `PUT /released-forms/:id/metadata`, still gated by `reqUtils.isOwnerOrAdminMw('id')`. The traveler updates are an internal, same-request side effect of an already-authorized action — not an independently reachable write path — the same pattern already used by `utilities/routes.js`'s `createTraveler`, which writes `Traveler.subsystem/device/activity` without its own per-field authorization check. |
| III. Two-Server Separation | ✅ Pass | All changes are in the web-app route file (`routes/form-management.js`) and a new `lib/` helper. `routes/api.js` is untouched. |
| IV. Composable Model Features | ✅ Pass (N/A) | This is a one-off, single-purpose backfill, not a cross-cutting behavior reused across Form/Traveler/Binder, so it does not need to be a schema mixin like `addReview`/`addShare`. It is implemented as a plain `lib/` function instead, consistent with other non-mixin shared logic (e.g. `lib/public-travelers.js`). |
| V. Minimal, Build-Free Frontend | ✅ Pass (N/A) | No frontend changes at all — the Jade views and JS already added in spec 003 (`released-form.jade`, `traveler.jade`) already display these fields; the backfilled values simply appear the next time a traveler is viewed. |

Development Workflow checks:
- New `lib/` function will have a corresponding `test/lib/` suite (per workflow requirement).
- `saveWithHistory(userid)` requirement for "audit-relevant" mutations: does not apply to the new traveler writes — `Traveler` has no `addHistory`/`saveWithHistory` registration anywhere in this codebase today (confirmed in `model/traveler.js`), so a plain `.save()` is the existing, correct pattern, not an exception to it. The released form's own mutation continues to use `saveWithHistory`, unchanged.

**Gate result**: All principles pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/008-backfill-traveler-metadata/
├── plan.md              ← this file
├── research.md           ← Phase 0 findings
├── data-model.md          ← Phase 1: entity/relationship notes (no schema changes)
├── quickstart.md          ← Phase 1: validation guide
├── contracts/
│   └── api-endpoints.md   ← Phase 1: modified endpoint contract
├── checklists/
│   └── requirements.md    ← spec quality checklist
└── tasks.md               ← Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
lib/
└── traveler-metadata.js   # NEW — backfillFromReleasedForm(releasedForm): finds matching
                            #       travelers and conditionally fills blank classification fields

routes/
└── form-management.js     # updateMetadata() calls backfillFromReleasedForm(f) after
                            # f.saveWithHistory(...) succeeds, before responding

test/lib/
└── traveler-metadata-test.js  # NEW — unit tests for backfillFromReleasedForm
```

**Structure Decision**: Single-project web application (existing structure, no new top-level directories). The only new file is a small `lib/` helper plus its test; the only modified file is the existing `PUT /released-forms/:id/metadata` handler. No model, view, or frontend JS changes are needed since the affected fields, their display, and their authorization are all already in place from spec 003.

## Complexity Tracking

*No constitution violations — this section is not applicable.*
