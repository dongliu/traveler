# Implementation Plan: Public Traveler Listing API & Dashboard

**Branch**: `004-public-traveler-dashboard` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-public-traveler-dashboard/spec.md`

## Summary

Add a shared listing library, `lib/public-travelers.js`, that returns public travelers (public
read or write access) a page at a time, newest update first, filtered by update-time range,
subsystem, device, activity, machine area, sector, Windchill ID, status, and tags, as JSON or CSV.
It is exposed through two thin route wrappers, one on the web app (session auth, for the
dashboard) and one on the REST API (basic auth), and both produce identical data. The public
travelers page is then rewritten as a dashboard in the NCR-dashboard style (status cards, filter
bar, server-paged table) that reads only from the web-app endpoint and keeps the existing select,
report, and add-to-binder actions.

The research turned up facts that shaped the approach (details in [research.md](research.md)):

- **Ordering needs an aggregation.** Both traveler-creation paths leave `updatedOn` unset, so the
  "updated" order must fall back to `createdOn`. That is a computed sort key, which `find()`
  cannot express. The query is a small aggregation that projects before it sorts, so the large
  embedded form data never enters the sort.
- **"Archived" already has a definition.** `archived === true` or `status === 4`. The lib uses it
  and reports an *effective status*, so the status cards sum correctly. The spec's Assumptions
  were corrected accordingly.
- **The old endpoint can go.** `/publictravelers/json` (whole documents, one consumer) is retired
  in favor of `/publictravelers/list`; `/apis/travelers/` is untouched.
- **Row selection depends on DataTables.** The shared helpers and binder modal call DataTables
  methods, so the dashboard keeps a DataTable purely as a row container and drives paging itself.
- **No schema, config, or index change.** The feature is read-only.

## Technical Context

**Language/Version**: Node.js (the project's current runtime; 20.x in this environment), Express 4.17; server code stays within ESLint `ecmaVersion: 2017` (no object spread, optional chaining, or `??`)

**Primary Dependencies**: Mongoose 5.13.13 (`Model.aggregate`), lodash (`escapeRegExp`), existing `lib/csv.js`, `lib/error.js` (`DataError`), `lib/loggers.js`; frontend jQuery, Bootstrap 2.x, DataTables 1.9 (as a row container only), Jade 1.10. **No new npm dependencies.**

**Storage**: MongoDB, existing `travelers` collection, read-only. No schema change, no migration, no new index (see [research D5](research.md))

**Testing**: Mocha + chai + sinon. New `test/lib/public-travelers-test.js` (pure functions, `list` against a fake model, handler smoke tests with stub `req`/`res`) and additions to `test/lib/csv-test.js`. Run files explicitly: the whole-directory run already fails on `ldap-client-test.js` (missing git-ignored `config/ad.json`), unrelated to this work

**Target Platform**: Web server (Express web app plus separate Express REST API server) and browsers running the existing jQuery UI

**Project Type**: Web application with two servers (session-authenticated web app, basic-auth REST API)

**Performance Goals**: Any page, filtered or not, and un-paged CSV in under 3 seconds for up to 5,000 public travelers (SC-001)

**Constraints**: No frontend build step; the web and API servers stay separate (shared logic in `lib/`); REST API additions only, no breaking change; ESLint (airbnb-base + prettier), Prettier 1.19, complexity ≤ 20; `getLogger()` instead of `console.log`; no unescaped user text in the UI

**Scale/Scope**: 3 new files (lib, unit tests, API doc page) and 6 modified (`lib/csv.js` + its test, `routes/traveler.js`, `routes/api.js`, `views/public-travelers.jade`, `public/javascripts/public-travelers.js`, `views/docs/api.jade`). No model files change

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Lifecycle State Machine | ✅ Pass | Read-only; no state is written or transitioned. Status is only *read* and mapped to names via the model's existing `statusMap`. |
| II. Permission-Layered Access | ✅ Pass | The listing serves only the last tier of the hierarchy (public access). That predicate (`publicAccess ∈ {0,1}`) lives in one place inside the shared lib and is not caller-configurable. Routes use `auth.ensureAuthenticated` / the API's `basicAuth`, as `/publictravelers/json` does today. No per-document middleware (`exist`, `canReadMw`) applies because no single protected document is addressed, and there are no inline permission checks in route bodies. Reviewers should confirm this reading. |
| III. Two-Server Separation | ✅ Pass | The web route lives in `routes/traveler.js` and the REST route in `routes/api.js`; neither file is mounted on the other server. All shared logic is in `lib/public-travelers.js`, which has no server dependency (the model is injected). |
| IV. Composable Model Features | ✅ Pass (n/a) | No cross-cutting model behavior added; no model file changes. |
| V. Minimal, Build-Free Frontend | ✅ Pass | jQuery + Bootstrap + Jade and a static file in `/public/javascripts/`; no bundler or framework. |

**Technology Stack and Workflow gates**

| Gate | Status | Notes |
|------|--------|-------|
| Mongoose schemas define explicit fields | ✅ Pass | No schema change. |
| Jade views use `getRenderObject` | ✅ Pass | The page route keeps `routesUtilities.getRenderObject(req)`. |
| Winston via `getLogger()` | ✅ Pass | Errors are logged with the shared logger; none use `console.log`. |
| New `lib/` functions have Mocha tests | ✅ Pass (planned) | `test/lib/public-travelers-test.js`, `test/lib/csv-test.js` additions. |
| New routes have a happy-path smoke test | ✅ Pass (planned) | Handler smoke tests plus the quickstart scenarios. |
| REST API backward-compatible | ✅ Pass | New `/apis/publictravelers/` is additive; `/apis/travelers/` is unchanged. The removed `/publictravelers/json` is a web-app endpoint with a single, rewritten consumer. |
| Config changes update examples and loader | ✅ Pass (n/a) | No config keys added. |
| `saveWithHistory` for entity mutations | ✅ Pass (n/a) | Nothing is mutated. |
| ESLint and Prettier | ✅ Planned | Checked in the quickstart. |

**Gate result (pre-research)**: All principles pass. No violations to justify.

**Re-check after Phase 1 design**: Unchanged. The design added no route beyond the two wrappers,
no model or config change, and no dependency. The only judgement call is the Principle II reading
above, recorded in Complexity Tracking as an item for reviewers rather than a violation.

## Project Structure

### Documentation (this feature)

```text
specs/004-public-traveler-dashboard/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0: decisions D1–D13
├── data-model.md        # Phase 1: record, query, result shapes and pipelines
├── quickstart.md        # Phase 1: runnable validation guide
├── contracts/
│   ├── public-travelers-list.md   # Web and REST listing contract
│   └── dashboard-ui.md            # Dashboard behavior contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
lib/
├── public-travelers.js        # NEW: parseListQuery, pipeline builders, toRecord, list, toCsv, listHandler
└── csv.js                     # + neutralizeFormula, toSafeCsvRow (existing exports untouched)

routes/
├── traveler.js                # + GET /publictravelers/list; − GET /publictravelers/json
└── api.js                     # + GET /apis/publictravelers/

views/
├── public-travelers.jade      # rewritten as the dashboard
└── docs/
    ├── api.jade               # + include the new API doc section
    └── api/public-travelers.md   # NEW: REST API documentation

public/javascripts/
└── public-travelers.js        # rewritten: server-driven paging, filters, status cards, CSV download

test/lib/
├── public-travelers-test.js   # NEW
└── csv-test.js                # + formula-neutralization tests
```

**Structure Decision**: Single Node.js project with a web app and a separate REST API server. All
listing behavior is in one new `lib/` module consumed by one small route in each server, so the
two audiences cannot drift apart. The dashboard reuses the existing page, static-file, and shared
table-helper conventions rather than introducing new frontend structure.

### Implementation outline (input to `/speckit-tasks`)

1. **CSV helpers**: add `neutralizeFormula` / `toSafeCsvRow` to `lib/csv.js` with tests; leave
   `escapeCsvValue` and `toCsvRow` as they are so feature 001's export is unchanged.
2. **Library core**: query parsing and validation, pipeline builders, record mapping (effective
   status, owner fallback, `archivedOn` rule), `list` (items and counts in parallel), CSV
   rendering, `listHandler`. Tests written alongside, pure functions first.
3. **Routes**: mount `listHandler` in `routes/traveler.js` (with the BOM option) and
   `routes/api.js`; delete `/publictravelers/json`.
4. **API docs**: new `public-travelers.md` and include it in `views/docs/api.jade`.
5. **Dashboard**: rewrite the Jade view and `public-travelers.js` per
   [contracts/dashboard-ui.md](contracts/dashboard-ui.md); status cards and filters last, since
   the table alone already delivers User Story 4.
6. **Validate**: run [quickstart.md](quickstart.md), including the 5,000-traveler timing check.

Story coverage: steps 1–3 deliver US1–US3 (the API), step 5 delivers US4 and US5.

## Complexity Tracking

*No constitution violations. One item for reviewers:*

| Item | Why it is noted | Resolution |
|------|-----------------|-----------|
| Principle II wording ("every route that accesses a protected document MUST use the `req-utils` factories") | The listing endpoints address no single document, so no factory such as `canReadMw` applies. Visibility is enforced by the public-access predicate in the shared lib. | Same model as the existing `/publictravelers/json`; the predicate sits in one place and is covered by unit tests (no non-public traveler in any output, SC-005). Flagged so a reviewer can confirm rather than discover it. |
