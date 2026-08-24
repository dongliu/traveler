# Implementation Plan: Traveler CSV Export

**Branch**: `001-traveler-csv-export` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-traveler-csv-export/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a read-only export endpoint that turns one traveler's identifying details and all of its
collected data into a downloadable CSV file. The traveler's field definitions live in
`traveler.labels`/`traveler.types` (keyed by each field's internal `name`, which is also the key
used on every `TravelerData` record), so the export enumerates that key set — guaranteeing every
defined field appears even if never answered — and joins in the latest `TravelerData` value/
inputBy/inputOn per field. Access is gated by the traveler's existing read-permission rules via
the same `req-utils.js` middleware already used by the sibling `/travelers/:id/json` route.

## Technical Context

**Language/Version**: Node.js (CommonJS, ES2017 target per existing `.eslintrc`), no TypeScript

**Primary Dependencies**: Express 4.17 (web app server), Mongoose 5.13 (MongoDB ODM), Lodash —
all already in `package.json`. No new runtime dependency is introduced; CSV serialization is
hand-rolled (see research.md) to match the codebase's existing preference for small local
utilities over adding packages for simple, well-understood algorithms.

**Storage**: MongoDB via existing `Traveler` and `TravelerData` Mongoose models
(`model/traveler.js`) — read-only for this feature, no schema changes

**Testing**: Mocha, run via `npx mocha test/lib/` (per CLAUDE.md); new tests go in `test/lib/`

**Target Platform**: Existing Node.js/Express server (the session-authenticated web app, not the
basic-auth REST API)

**Project Type**: Single Express monolith (existing `routes/`, `model/`, `lib/`, `utilities/`,
`views/` layout) — web application

**Performance Goals**: Matches SC-001 — CSV for a typical traveler (~200 fields) generated and
returned in under 5 seconds; this is a single indexed `TravelerData.find({_id: {$in: ...}})`
query plus in-memory string building, well within that budget

**Constraints**: Output MUST be valid CSV (RFC 4180-style escaping) openable in common
spreadsheet tools (SC-005); no new UI framework or build step (Constitution Principle V)

**Scale/Scope**: Single traveler per request; traveler data field counts observed in this
codebase are small-to-moderate (tens to low hundreds), well below any streaming threshold

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability | Assessment |
|---|---|---|
| I. Lifecycle State Machine | Export is read-only; touches no `status` field on Traveler/Form/Binder | PASS — no state transition involved |
| II. Permission-Layered Access Control | New route reads a protected `Traveler` document | PASS — reuses `reqUtils.exist('id', Traveler)` + `reqUtils.canReadMw('id')`, the same middleware pair used by the existing `/travelers/:id/json` route; no inline permission checks |
| III. Two-Server Separation | Route belongs to a specific server | PASS — added only to `routes/traveler.js`, mounted on the session-authenticated web app (`app`), not `routes/api.js` |
| IV. Composable Model Features | No cross-cutting entity behavior (review/share/history) is introduced | N/A — export is a stateless read aggregation, not a schema mixin |
| V. Minimal, Build-Free Frontend | Adds one user-facing entry point (a download link) | PASS — a plain `<a>` tag added to existing Jade views, no new JS framework or build step |

No violations. Complexity Tracking table is not needed.

**Post-Phase 1 re-check**: research.md and data-model.md confirm the design touches no state
field, adds no schema/mixin, stays on the web app server only, adds zero new npm dependencies,
and its one UI touchpoint is a plain anchor tag. All five rows above still hold; no new gates
triggered.

## Project Structure

### Documentation (this feature)

```text
specs/001-traveler-csv-export/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── csv-export.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
routes/
└── traveler.js          # add GET /travelers/:id/csv route (web app only, per Principle III)

lib/
└── csv.js               # new: generic RFC-4180-style row/value escaping helper

model/
└── traveler.js           # read-only: Traveler.labels/types/mapping, TravelerData (no changes)

views/
├── traveler.jade         # add a "Download CSV" link (write-access traveler view)
└── traveler-viewer.jade  # add a "Download CSV" link (read-only traveler view)

test/lib/
└── csv-test.js           # new: unit tests for lib/csv.js escaping behavior
```

**Structure Decision**: Existing single-project Express layout is reused as-is (no new
directories). The feature adds one route handler in the existing `routes/traveler.js`, one small
shared helper in `lib/` (per Constitution: "shared logic belongs in `/lib/` or `/utilities/`, not
in route files"), and one new test file under `test/lib/`, matching the pattern of the existing
`test/lib/req-utils-test.js`.

## Complexity Tracking

*No Constitution Check violations — this section is intentionally empty.*
