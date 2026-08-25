# Implementation Plan: WBS YAML Config File

**Branch**: `120-wbs-yaml-config` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-wbs-yaml-config/spec.md`

**Updated**: 2026-08-24 — Clarification applied: admin page WBS management removed entirely; YAML is sole source.

## Summary

Replace the existing admin-page-based WBS notification registry with a file-based approach. A new `lib/wbs-yaml-loader.js` module reads an optional `wbs.yaml` from the active config directory at startup and populates an in-memory map. All WBS resolution and listing uses this map exclusively — no database queries. The existing WBS admin CRUD routes, service functions, and Mongoose model are removed.

## Technical Context

**Language/Version**: Node.js 20 (LTS) — existing runtime

**Primary Dependencies**: Express 4, Mongoose 7 (still used for other models), `js-yaml` (new), Winston (logging) — all others existing

**Storage**: No new storage. `config.wbsYaml` in-memory plain object. MongoDB `wbs_notifications` collection is no longer read or written at runtime; the Mongoose model is deleted from the codebase.

**Testing**: Mocha + Chai + Sinon — existing test framework

**Target Platform**: Linux server (Docker Compose), same as existing deployment

**Project Type**: Web application (Express + Jade/Pug server-side rendering)

**Performance Goals**: Startup YAML loading synchronous, < 50 ms for files with hundreds of entries; WBS resolution is now an in-memory object lookup (O(n) ancestor walk), faster than the prior MongoDB query

**Constraints**: YAML file is optional — zero degradation if absent; no new runtime external service calls; existing DB queries for other collections are unaffected

**Scale/Scope**: Single application instance; expected < 1,000 WBS entries in YAML

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Automated Testing | PASS | New `lib/wbs-yaml-loader.js` requires unit tests; modified `wbs-notification-service.js` requires updated unit tests; e2e tests for removed CRUD flows must be updated |
| II. Code Quality and Consistency | PASS | YAML loading logic in `lib/` per "logic abstracted into shared libraries" rule; ESLint must pass; deleted files leave no dead code |
| III. Security-First Architecture | PASS | YAML file is admin-controlled, not user input; path derived from trusted `configPath`; email and WBS values validated with same rules as before; removing CRUD endpoints reduces attack surface |
| IV. Versioning & Breaking Changes | PASS | Breaking change: POST/PATCH/DELETE `/wbs-notifications/` removed — must be documented in release notes; existing DB entries become unreachable (admin migration responsibility per spec) |
| V. Documentation | PASS | `config/wbs.yaml` format documented; CLAUDE.md updated; breaking change noted; `js-yaml` dependency documented |

**No violations requiring Complexity Tracking.**

## Project Structure

### Documentation (this feature)

```text
specs/007-wbs-yaml-config/
├── spec.md
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── wbs-notification-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code Changes

```text
# New files
lib/wbs-yaml-loader.js                          ← NEW: YAML loader module
config/wbs.yaml                                 ← NEW: example/template (optional file)
docker/wbs.yaml                                 ← NEW: example/template (optional file)
test-unit/lib/wbs-yaml-loader.test.js           ← NEW: unit tests for loader

# Modified files
config/config.js                                ← MODIFIED: call loader in load(), expose config.wbsYaml
lib/wbs-notification-service.js                 ← MODIFIED: remove CRUD functions; resolveWbsContact and listEntries use in-memory map only
routes/wbs-notification.js                      ← MODIFIED: remove POST/PATCH/DELETE routes; GET returns YAML entries
test-unit/lib/wbs-notification-service.test.js  ← MODIFIED: remove CRUD tests; add YAML-aware tests
e2e/us-wbs-notification-registry.spec.js        ← MODIFIED: replace CRUD scenarios with YAML-based scenarios
e2e/us-wbs-hierarchical-notification-lookup.spec.js ← MODIFIED: update fixture setup to use YAML instead of DB
views/ (admin WBS page)                         ← MODIFIED: remove add/edit/delete UI; show read-only YAML list
public/javascripts/wbs-notifications.js         ← MODIFIED: remove management controls; render read-only list

# Deleted files
model/wbs-notification.js                       ← DELETED: Mongoose model no longer needed
```

**Structure Decision**: Single-project layout (existing app). Changes are mostly deletions and simplifications within established directories.
