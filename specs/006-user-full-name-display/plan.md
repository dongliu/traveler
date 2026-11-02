# Implementation Plan: Show People's Full Names Instead of Initials or User IDs

**Branch**: `006-user-full-name-display` | **Date**: 2026-11-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-user-full-name-display/spec.md`

## Summary

Every list/table view in the app (forms, travelers, binders, released forms, reviews) currently identifies a person by either a single-letter avatar icon (`personColumn` in `public/javascripts/table.js`) or a bare account identifier (the public travelers dashboard, and several single-record detail/config pages rendered server-side in Jade). This feature replaces both with the person's full name, sourced from their `User` account record (`model/user.js`), while leaving the underlying stored identifier untouched everywhere it is used as a key, a sort/filter value, or a field in the REST API's JSON responses (per the Clarifications in spec.md).

The technical approach is one shared, request-scoped name-resolution utility (`lib/user-names.js`) invoked at each existing read path — internal DataTables JSON endpoints, the public travelers listing/CSV, and the handful of server-rendered Jade detail pages that interpolate a raw account id. The utility batches a single `User.find({_id: {$in: ids}}, 'name')` per response (never per row), and falls back to the raw identifier when no name is on file. At the wire-format level, every call site adds a sibling `<field>Name` value alongside the existing field rather than changing what that field means — the one deliberate exception being the public travelers list's CSV export, whose "created by"/"updated by" cell values are replaced outright with the full name, per that clarification. On top of that unchanged wire data, the DataTables-rendering `personColumn` helper itself switches its display **and** its sort/filter behavior over to the resolved name, per FR-005 — so what a viewer sees, searches, and sorts by is consistently the name, even though the underlying field sent over the wire is untouched.

## Technical Context

**Language/Version**: Node.js (CommonJS), ES2017+ syntax already used in `/lib/` and `/routes/` (`async`/`await`, arrow functions)

**Primary Dependencies**: Express 4.x (two instances: session-auth web app, basic-auth REST API — `app.js`), Mongoose 5.13.x against MongoDB, Jade/Pug templating, jQuery + Bootstrap + legacy jQuery DataTables (1.9.x-era `sAjaxSource`/`mData`/`mRender` API) on the frontend, lodash

**Storage**: MongoDB via Mongoose. No schema or stored-data changes: `User.name` already exists and is already populated from the organization's identity source (`lib/auth.js`, `routes/user.js`, `lib/share.js`, `routes/group.js` all write it from AD's `displayName`). This feature only *reads* it.

**Testing**: Mocha 5 + Chai 4 + Sinon 7, `test/lib/*-test.js`, run via `npx mocha test/lib/`. `lib/public-travelers.js` is explicitly designed to run with no live database — its existing test (`test/lib/public-travelers-test.js`) passes a fake `Traveler` model whose only method is `aggregate`, and asserts no other model method is called; the new name-resolution dependency must be injectable so that guarantee still holds.

**Target Platform**: Server-rendered web app + JSON REST API, both Node/Express; browser clients are desktop Bootstrap/jQuery pages, no mobile app.

**Project Type**: Existing monolithic web application (session-auth web app + REST API sharing `/lib/` and `/model/`) — not a greenfield project; this feature extends existing routes and views rather than adding new top-level components.

**Performance Goals**: No perceptible slowdown of any existing list page or API response. Name resolution MUST be a single batched query per response (distinct ids only), not one query per row, so cost scales with the number of *distinct* people on a page (typically a handful), not the number of rows (up to 500 for the REST API, more for some internal un-paged lists).

**Constraints**: REST API (`routes/api.js`) backward compatibility is constitutionally required (Principle III / Technology Stack) — existing JSON field values and meanings must not change (FR-007). No new build step or frontend framework (Principle V). No new runtime config.

**Scale/Scope**: Touches every `personColumn`-rendered column across forms/travelers/binders/released-forms/reviews list views (table.js: `reviewerIdColumn`, `createdByColumn`, `clonedByColumn`, `updatedByColumn`, `releasedByColumn`, `archivedByColumn`, `useridColumn`, `addedByColumn`, plus `traveler-discrepancy-form-loader.js`'s own use of `personColumn`), the public travelers dashboard + its REST/CSV surface (`lib/public-travelers.js`, `routes/api.js`, `routes/traveler.js`), the other REST API endpoints that already expose these same fields (`/apis/travelers/`, `/apis/travelers/:id/`, documented in `views/docs/api/`), and a handful of Jade detail/config pages that interpolate the raw id directly (`views/traveler.jade`, `views/traveler-viewer.jade`, `views/traveler-print.jade`, `views/traveler-config.jade`, `views/form-config.jade`, `views/binder-config.jade`, `views/binder.jade`) — see research.md for why these last seven are included even though the spec's literal wording names only "list/table views" and "the public travelers dashboard".

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see note at the end of this section.*

| Principle | Status | Notes |
|---|---|---|
| I. Lifecycle State Machine | PASS | Purely a read/display change. No entity state, `stateTransition`, or mutation is touched. |
| II. Permission-Layered Access Control | PASS | No new access pattern and no change to the owner → reviewer → sharedWith → sharedGroup → publicAccess hierarchy. A viewer only ever sees the full name of a person whose bare identifier they could already see in the same, already-authorized response — this feature changes what a field *shows*, never who can reach it (confirmed for the broadest case, the public travelers dashboard, via the 2026-11-01 clarification session in spec.md). |
| III. Two-Server Separation | PASS | The shared resolver lives in `/lib/` (`lib/user-names.js`), not in a route file, and is called independently from the web app's and the REST API's own route handlers — no route file is mounted on the other server. FR-007 exists specifically to protect the REST API's backward-compatibility guarantee required by this principle and by the Technology Stack section. |
| IV. Composable Model Features | PASS, with a noted interpretation | Review/share/history are mixed into schemas via `schema.plugin()` because they are entity *behaviors* (workflow, audit, access) that mutate or gate the document. Resolving a display name is a read-time response-shaping concern, not an entity behavior, and several of the read paths that need it (`Traveler.aggregate(...)` in `lib/public-travelers.js`, plain Jade locals) cannot carry Mongoose schema virtuals at all. The plan keeps the "no duplicated logic" intent by putting the resolution logic in exactly one shared `/lib/` function, called identically from every site, rather than reimplementing it per model or per route. Flagged here for reviewer visibility since it is a judgment call, not because it violates the principle's text. |
| V. Minimal, Build-Free Frontend | PASS | `public/javascripts/table.js` and `public/javascripts/public-travelers.js` keep using plain jQuery/DataTables; no bundler, no framework, no new static asset pipeline. The `holder.js` placeholder-avatar usage is removed, not replaced with a richer widget. |
| Technology Stack / Dev Workflow | PASS | New `lib/user-names.js` gets a Mocha test under `test/lib/`, per "every new `lib/` function MUST have corresponding tests." No `console.log`; any new logging goes through `lib/loggers.js`. No config schema changes. No entity mutation, so `saveWithHistory` is not implicated. |

**Post-Phase-1 re-check**: No new violations surfaced while writing data-model.md or the contracts — the additive-field wire contract (FR-007) and the single, explicitly out-of-scope CSV substitution (FR-008) are the only wire-format decisions, and both are already reflected in spec.md's Clarifications. Gate remains PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-user-full-name-display/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
│   ├── public-travelers-api.md
│   └── internal-json-endpoints.md
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

This is an existing Express application (see `CLAUDE.md`); this feature adds one new shared library module and modifies existing routes, views, and frontend scripts. No new top-level directories.

```text
lib/
├── user-names.js          # NEW — batched id → full-name resolution, with graceful fallback
├── public-travelers.js    # MODIFIED — toRecord() gains createdByName/updatedByName/ownerName;
│                          #   toCsv() substitutes the resolved name into createdBy/updatedBy cells
└── req-utils.js           # unchanged (reference point for the existing "shared lib helper used by
                            #   many routes" pattern this feature follows)

model/
├── user.js                # unchanged — already has `name`; this feature only reads it
├── form.js, traveler.js, binder.js, released-form.js, review.js
                            # unchanged schemas — createdBy/updatedBy/releasedBy/archivedBy/
                            #   clonedBy/addedBy/inputBy/owner/reviewRequests._id stay plain
                            #   Strings; no ref/virtual added (see research.md)

routes/
├── form.js, traveler.js, binder.js, review.js
                            # MODIFIED — each existing `/*/json` list handler calls
                            #   lib/user-names.js once before res.json(...)
└── api.js                 # MODIFIED — /apis/publictravelers/, /apis/travelers/,
                            #   /apis/travelers/:id/ gain additive name field(s)

views/
├── traveler.jade, traveler-viewer.jade, traveler-print.jade, traveler-config.jade,
│   form-config.jade, binder-config.jade, binder.jade
                            # MODIFIED — interpolate the resolved name local instead of the
                            #   raw account id
└── docs/api/public-travelers.md, traveler.md, travelers.md
                            # MODIFIED (implementation-time doc update, not a plan artifact)

public/javascripts/
├── table.js                # MODIFIED — personColumn() renders `<key>Name` as text, drops the
│                            #   holder.js avatar image entirely
├── public-travelers.js     # MODIFIED — personAndDate() receives the resolved name
└── traveler-discrepancy-form-loader.js
                            # MODIFIED — its personColumn('Documented by', 'inputBy') call
                            #   picks up the same behavior automatically once table.js changes

test/lib/
├── user-names-test.js      # NEW
└── public-travelers-test.js
                            # MODIFIED — extended for the new, injectable name dependency
```

**Structure Decision**: No structural change to the repository. This is a cross-cutting read-path feature layered onto the existing `/lib/`, `/model/`, `/routes/`, `/views/`, `/public/javascripts/` structure described in `CLAUDE.md`; the single new file (`lib/user-names.js`) follows the same "shared library used by many routes" pattern already established by `lib/req-utils.js` and `lib/review.js`.

## Complexity Tracking

*No entries — the Constitution Check above found no violation requiring justification. The Principle IV note is an interpretation, not a deviation that needed a simpler alternative rejected.*
