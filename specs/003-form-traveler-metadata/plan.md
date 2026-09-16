# Implementation Plan: Form & Traveler Metadata Fields

**Branch**: `003-form-traveler-metadata` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-form-traveler-metadata/spec.md`

## Summary

Add six classification/instance metadata fields across two models. `ReleasedForm` gains `subsystem`, `device`, and `activity` — captured at release time and editable post-release by the owner or admin. `Traveler` gains those same three fields (copied from the released form at creation, read-only thereafter) plus `machineArea`, `sector`, and `windchillId` (user-supplied, editable while the traveler is in an active state).

No new architectural patterns are introduced: the change extends existing model schemas, existing route handlers, the single `createTraveler` utility function, and existing Jade views with the established inline-edit AJAX pattern.

## Technical Context

**Language/Version**: Node.js (project's current version); Express 4.x

**Primary Dependencies**: Mongoose (schema/model changes), Express (route changes), Jade (view changes), jQuery + Bootstrap 2.x (frontend AJAX and UI)

**Storage**: MongoDB via Mongoose — schema additions only; all new fields default to `''`, so existing documents are backward-compatible with no migration script required

**Testing**: Mocha — `test/lib/` for unit tests on `createTraveler` and new route logic

**Target Platform**: Web server (session-authenticated browser UI)

**Project Type**: Web application — Jade-rendered UI on the web-app server; no REST API changes needed for this feature

**Performance Goals**: No new performance considerations; all changes are simple field reads/writes

**Constraints**: No build pipeline; no new npm dependencies; `saveWithHistory` required for all mutations per the constitution

**Scale/Scope**: Feature touches 4 source files (2 models, 2 route files), 1 utility function, 2–3 Jade views, and 1–2 frontend JS files

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Lifecycle State Machine | ✅ Pass | No state transitions added. `reqUtils.status` guard on `/config` updated from `[0,1]` to `[0,1,1.5]` — this is a guard extension, not a new transition. Released form metadata edits do not change form state. |
| II. Permission-Layered Access | ✅ Pass | New `PUT /released-forms/:id/metadata` uses `reqUtils.isOwnerOrAdminMw`. Existing `/config` route already uses `isOwner \|\| admin` check. No inline permission checks. |
| III. Two-Server Separation | ✅ Pass | All changes are in web-app routes (`form.js`, `form-management.js`, `traveler.js`). REST API (`routes/api.js`) is untouched. |
| IV. Composable Model Features | ✅ Pass | No new cross-cutting behaviors. `addHistory` plugin extended with new field names only. |
| V. Minimal, Build-Free Frontend | ✅ Pass | jQuery + Bootstrap only. Static JS files in `/public/javascripts/`. No build step. |

**Gate result**: All principles pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/003-form-traveler-metadata/
├── plan.md              ← this file
├── research.md          ← Phase 0 findings
├── data-model.md        ← Phase 1: schema changes
├── quickstart.md        ← Phase 1: validation guide
├── contracts/
│   └── api-endpoints.md ← Phase 1: route contracts
├── checklists/
│   └── requirements.md  ← spec quality checklist
└── tasks.md             ← Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
model/
├── released-form.js      # add subsystem, device, activity fields + history plugin update
└── traveler.js           # add 6 new fields + history plugin update

routes/
├── form.js               # update releaseForm() to read new fields from req.body
├── form-management.js    # add PUT /released-forms/:id/metadata route
└── traveler.js           # extend /travelers/:id/config filter + status guard

utilities/
└── routes.js             # update createTraveler() to copy 3 fields from released form

views/
├── released-form.jade    # display 3 fields; inline-edit controls for owner/admin
├── form-management.jade  # add 3 fields to the release modal (form-builder release flow)
└── traveler.jade         # display 6 fields; inline-edit controls for machineArea/sector/windchillId

public/javascripts/
├── released-form-management.js  # add AJAX handler for metadata edit
└── traveler.js (or traveler-config.js)  # extend config PUT call to include new fields
```

**Structure Decision**: Single-project web application. No new files required for models or routes — all changes extend existing files. A new small JS block is added to the existing `released-form-management.js` for the metadata edit action.

## Complexity Tracking

*No constitution violations — this section is not applicable.*
