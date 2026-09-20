# Tasks: Public Traveler Listing API & Dashboard

**Input**: Design documents from `specs/004-public-traveler-dashboard/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included, but as a constitution requirement rather than test-first: new `lib/` functions MUST have Mocha tests in `test/lib/`, and every new route MUST have a happy-path smoke test. The smoke tests send real HTTP requests (Node's built-in `http`, no new dependency) to a tiny Express app on an ephemeral port that mounts `listHandler` with a fake model, so query-string parsing is exercised exactly as Express does it; route mounting and authentication are checked by the quickstart. Test tasks follow the implementation they cover, in the same phase. Run test files explicitly (`npx mocha test/lib/public-travelers-test.js test/lib/csv-test.js test/lib/req-utils-test.js`); the whole-directory run already fails on `ldap-client-test.js` (missing git-ignored `config/ad.json`), which is unrelated.

**Organization**: Tasks are grouped by user story so each can be implemented and validated on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5, matching `spec.md`
- Requirement IDs (FR-xxx, SC-xxx) point at `spec.md`; "data-model" and "contract" point at the files in this directory

## Conventions for every task

- Server code stays within ESLint `ecmaVersion: 2017`: **no** object spread, optional chaining, or `??`. Prettier is 1.19.
- No new npm dependencies. Use `lodash` (already installed) for `escapeRegExp`, `DataError` from `lib/error.js` for client errors, and `require('./loggers').getLogger()` for logging (never `console.log`).
- `lib/public-travelers.js` must not depend on Express or on a live database connection at import time. It receives the Traveler model as an argument, so unit tests can pass a fake.
- "Public" is defined in exactly one place, `publicAccessMatch()` in `lib/req-utils.js` (T006). Never write a `publicAccess` condition anywhere else.

---

## Phase 1: Setup

- [ ] T001 Confirm the baseline on branch `Ernest`: run `npx mocha test/lib/csv-test.js test/lib/req-utils-test.js` (expect 21 passing) and `npx eslint lib/csv.js` (expect no errors), so later failures can be attributed to this feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The record mapping, strict input readers, and the shared public-tier predicate that every story uses.

**⚠️ CRITICAL**: No user story work starts until this phase is done.

- [ ] T002 Create `lib/public-travelers.js` with: constants (`DEFAULT_LIMIT` 25, `MAX_LIMIT` 500, `MAX_PAGE` 100000, `MAX_TEXT_LENGTH` 200); the effective-status helper `effectiveStatus(doc)` returning `{code, name}` (archived when `doc.archived === true` or `status === 4`; names from `statusMap` exported by `model/traveler.js`; a status that is missing or not one of 0, 1, 1.5, 2, 3 counts as `initialized`, the schema default, so no traveler is ever `unknown`); and `toRecord(doc)` producing the record in data-model "Public Traveler Record" (`_id`, `title`, `status`, `statusCode`, `createdBy`, `createdOn`, `updatedBy`, `updatedOn`, `archivedOn`, `owner`, `tags`, `totalInput`, `finishedInput`, and the six classification fields). Rules: `owner || createdBy`; `archivedOn` only when `archived === true`, else `null`; `''` for missing strings, `null` for missing dates, `[]` for tags, `0` for counts; every key always present. Export the functions (FR-006, FR-007)
- [ ] T003 Create `test/lib/public-travelers-test.js` (chai `should`, like `test/lib/csv-test.js`) with tests for `effectiveStatus` (archived flag over any status, status 4 without the flag, each of 0/1/1.5/2/3, a missing or unrecognized status treated as initialized) and `toRecord` (all keys present for an empty document, owner fallback, `archivedOn` hidden when not flagged even if a stale date exists, blank defaults, `statusCode` matches `status`)
- [ ] T004 In `lib/public-travelers.js` add strict input readers used by all parsing: `readString(query, name)` returns a trimmed string or `''`, and throws `DataError(…, 400)` naming the parameter when the value is not a string (this rejects objects such as `subsystem[$ne]=x`); `readList(query, name)` accepts a string or an array of strings, splits on commas, trims, drops blanks, and throws `DataError` 400 for any other type. Export both
- [ ] T005 In `test/lib/public-travelers-test.js` add tests for `readString` and `readList` (blank and missing → `''` / `[]`, repeated and comma-separated lists, object input rejected with status 400 and a message naming the parameter)
- [ ] T006 Add and export `publicAccessMatch(defaultAccess)` in `lib/req-utils.js`, next to `getAccess`, as the single definition of the "public tier" for listings. `defaultAccess` defaults to `require('../config/config').app.default_traveler_public_access`. When that default is `0` or `1`, return `{$or: [{publicAccess: {$in: [0, 1]}}, {publicAccess: {$exists: false}}]}`: Mongoose gives a document with no stored field that default, so `getAccess` already treats it as public, while a stored `null` or `-1` stays non-public. Otherwise return `{publicAccess: {$in: [0, 1]}}`. Add a comment pointing at `getAccess` (FR-001; research D14)
- [ ] T007 In `test/lib/req-utils-test.js` add tests for `publicAccessMatch`: defaults `0` and `1` include the `$exists: false` branch; defaults `-1`, `undefined`, and `''` (config not loaded) return the plain `$in [0, 1]` form; and no variant ever matches a stored `-1` or `null`

**Checkpoint**: Mapping, input readers, and the public-tier predicate are covered by passing tests.

---

## Phase 3: User Story 1 — Retrieve public travelers a page at a time, newest update first (Priority: P1) 🎯 MVP

**Goal**: A JSON list of public, non-archived travelers, newest update first, paged, with every property, available to signed-in web users and to REST API credential holders.

**Independent Test**: quickstart.md §3 scenarios 1, 2, 3, 13 (paging errors only), 14, 15, 20, 21, 22, and 23, using the seed data in §2, plus the 5,000-traveler timing in §6.

### Implementation for User Story 1

- [ ] T008 [US1] In `lib/public-travelers.js` add `parsePaging(query)` (default page 1 / limit 25; non-integer, zero, negative, or `page` above 100000 → `DataError` 400 with the messages in contract "Errors"; `limit` above 500 is reduced to 500) and a first version of `parseListQuery(query)` that returns `{page, limit, paged, statuses: [], includeArchived: false}`, where `paged` is true when `page` or `limit` was supplied. Later stories extend `parseListQuery` (FR-004, FR-021)
- [ ] T009 [US1] In `lib/public-travelers.js` add `buildBaseMatch(params)` returning the `$match`, with its conditions combined under `$and` so the `$or` in the public match and in the date range cannot collide: the result of `publicAccessMatch()` from `lib/req-utils.js` (T006) plus the default archived exclusion (`archived: {$ne: true}`, `status: {$ne: 4}`) unless `params.includeArchived` is true, and `buildItemsPipeline(params)`: `$match` → `$project` (only the record fields listed in data-model "Source fields", plus `_sortKey: {$ifNull: ['$updatedOn', '$createdOn']}`) → `$sort {_sortKey: -1, _id: -1}` → `$skip` and `$limit` computed from `page`/`limit` (both omitted when `params.paged` is false). The public-access condition comes only from `publicAccessMatch()` and must not be influenced by any parameter (FR-001, FR-002, FR-003)
- [ ] T010 [US1] In `lib/public-travelers.js` add `buildCountsPipeline(params)` (`$match` from `buildBaseMatch` → `$group` by effective status: `4` when `archived == true` or `status == 4`, else `$status` when it is one of 1, 1.5, 2, 3, else `0`, so a missing status is counted as initialized) and `summarizeCounts(groupRows, statuses, includeArchived)` returning `{total, statusCounts}`: `statusCounts` keyed by status name with `0` for absent names and the `archived` key only when `includeArchived` is true; `total` is the sum over the requested statuses, or over all of them when none are requested (FR-005, FR-022)
- [ ] T011 [US1] In `lib/public-travelers.js` add `list(Traveler, params)`: run the items and counts pipelines in parallel (`Traveler.aggregate(pipeline).allowDiskUse(true)`), map items through `toRecord`, and resolve `{travelers, page, limit, total, statusCounts}` (FR-005, FR-009). Use only read operations (`aggregate`, never `save`/`update`), so the listing cannot modify a traveler (FR-024). Export the builders and `list`
- [ ] T012 [US1] In `test/lib/public-travelers-test.js` add tests for `parsePaging`/`parseListQuery` (defaults, clamp to 500, each invalid value → 400), the pipelines (first stage contains the public-access predicate; archived excluded by default; `$project` lists only the record fields and never `forms`; sort key and tie-break; skip/limit values for page 3 of 25; no skip/limit when `paged` is false), `summarizeCounts` (sum, zero fill, no `archived` key by default), the counts `$group` id expression (falls back to 0 for a missing or unrecognized status), and that the base match embeds `publicAccessMatch()`'s output unchanged, and `list` against a fake model whose `aggregate` returns canned rows (records mapped, envelope keys present, both pipelines called)
- [ ] T013 [US1] In `lib/public-travelers.js` add `listHandler(Traveler, options)` returning an Express handler `(req, res)`: `parseListQuery(req.query)` → `list` → `res.status(200).json(result)`. Map `DataError` to `res.status(err.status).json({error: err.message})`; log any other error with `getLogger()` and respond `500` with `{error: 'internal error'}` (FR-021). Export it
- [ ] T014 [US1] In `test/lib/public-travelers-test.js` add the handler smoke tests as real HTTP: a helper starts a tiny Express app on `127.0.0.1` port `0` that mounts `GET /list` with `listHandler(fakeModel)`, requests it with Node's built-in `http.get`, and closes the server in an `after` hook. Cases: happy path (200, `application/json`, the JSON envelope with every record key); `?limit=0` (400 with a JSON `{error}` naming the parameter and no aggregate call); `?limit=9999` (200 with `limit` 500); and a fake model whose `aggregate` rejects (500 with the generic `internal error` message, details not echoed). No new dependency
- [ ] T015 [P] [US1] In `routes/traveler.js` add `app.get('/publictravelers/list', auth.ensureAuthenticated, publicTravelers.listHandler(Traveler))` next to the existing `/publictravelers/` routes and `require('../lib/public-travelers')` at the top. Do **not** remove `/publictravelers/json` yet; the current page still uses it until User Story 4 (FR-023)
- [ ] T016 [P] [US1] In `routes/api.js` add `app.get('/apis/publictravelers/', publicTravelers.listHandler(Traveler))` (basic auth is already applied to the whole API server in `app.js`) and require the lib. Leave `/apis/travelers/` unchanged (FR-023)
- [ ] T017 [P] [US1] Create `views/docs/api/public-travelers.md` in the style of `views/docs/api/travelers.md`: method, URL `https://hostname:port/apis/publictravelers/`, `page`/`limit` paging, the JSON response with a sample record, `statusCounts`, and the error format; then add a `section#api-public-travelers` with `include:marked api/public-travelers.md` to `views/docs/api.jade` after the travelers section
- [ ] T018 [US1] Validate User Story 1 against a running app and MongoDB per `specs/004-public-traveler-dashboard/quickstart.md` §2 (seed data) and §3 scenarios 1, 2, 3, 13 (paging errors), 14, 15, 20, 21, 22, 23 (SC-002: every record has all keys; SC-003: paging returns each traveler exactly once, in order; scenarios 22 and 23 check the `publicAccess` and status defaults). **Also run the SC-001 timing here, as a gate before US2–US5:** load about 5,000 public travelers with realistic embedded forms (quickstart §6) and time page 1, a deep page (for example `page=100&limit=50`), and `limit=500`; each must finish in under 3 seconds with no "Sort exceeded memory limit" in the log. This is also the first check of the aggregation pipelines against a real database. Fix any pipeline or performance problem in `lib/public-travelers.js` (or apply the escape hatch in `research.md` D4/D5) before starting Phase 4

**Checkpoint**: US1 delivers a working, paged JSON API on both servers. **This is the MVP.**

---

## Phase 4: User Story 2 — Narrow the list with filters (Priority: P1)

**Goal**: Filter by update-time range, six classification fields, status, tags, and include-archived, in any combination.

**Independent Test**: quickstart.md §3 scenarios 4–13.

### Implementation for User Story 2

- [ ] T019 [US2] In `lib/public-travelers.js` extend `parseListQuery` with filter parsing per data-model "Listing Query": `updatedFrom`/`updatedTo` via a `parseDateBound` helper (`YYYY-MM-DD` → local start or end of that day; a full ISO 8601 timestamp used exactly; anything else → 400; `from` after `to` → 400); the six text filters via `readString` with the 200-character limit; `status` via `readList`, each value a case-insensitive name or a code among 0, 1, 1.5, 2, 3, 4, normalized to codes, with an unknown value producing the 400 message listing accepted names and codes; `tags` via `readList`; `includeArchived` accepting `true`/`false`/`1`/`0` (else 400). Set `params.includeArchived` to the **effective** value: the option OR the status list containing 4 (FR-015–FR-019, FR-021)
- [ ] T020 [US2] In `lib/public-travelers.js` extend `buildBaseMatch` so the match also contains: the date range as `{$or: [{updatedOn: {$gte, $lte}}, {updatedOn: null, createdOn: {$gte, $lte}}]}` (omit an unset bound); each text filter as `{field: {$regex: <lodash escapeRegExp(value)>, $options: 'i'}}`; and each tag as its own `{tags: {$regex: '^<escaped>$', $options: 'i'}}` condition combined under `$and`. Blank filters add nothing. All values must be built typed, since aggregation does not cast (FR-015, FR-016, FR-018, FR-019, FR-020)
- [ ] T021 [US2] In `lib/public-travelers.js` add `buildStatusMatch(codes)` (codes 1, 1.5, 2, 3 → `{archived: {$ne: true}, status: {$in: [...]}}`; code 0 (initialized) → `{archived: {$ne: true}, status: {$nin: [1, 1.5, 2, 3, 4]}}`, which also matches a missing status; code 4 → `{$or: [{archived: true}, {status: 4}]}`; several parts OR-ed) and add it to the **items** pipeline's `$match` only, so the counts pipeline keeps ignoring the status filter but still honors the effective include-archived. Confirm `list` uses `summarizeCounts` with the requested statuses so `total` reflects the status filter (FR-017, FR-022)
- [ ] T022 [US2] In `test/lib/public-travelers-test.js` add tests for: `parseDateBound` (date-only bounds are local day start and end, ISO used exactly, invalid, reversed range); text filters (regex escaped so `(`, `.*`, `[` are literal, case-insensitive flag, over-long value → 400); injection rejection (`{$ne: 'x'}` for a text filter, for `status`, and for `tags`); status normalization (names in any case, numeric codes, `1.5`, several values, unknown → message lists accepted values); tags (each tag is its own anchored condition, all required); blank values ignored; `includeArchived` parsing and the effective rule when `status` contains `archived`; that `buildStatusMatch` produces the expected shapes (including the `$nin` form for code 0); that the counts pipeline has no status condition; and that `summarizeCounts` applies the status selection to `total`. Add one real-HTTP case using the T014 helper: send `?subsystem[$ne]=x` and `?status[$gt]=1`, which Express parses into objects, and assert a 400 with no aggregate call
- [ ] T023 [P] [US2] Extend `views/docs/api/public-travelers.md` with the filter parameters (`updatedFrom`, `updatedTo`, `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId`, `status`, `tags`, `includeArchived`), how each matches, and two or three example URLs from the contract
- [ ] T024 [US2] Validate User Story 2 per `specs/004-public-traveler-dashboard/quickstart.md` §3 scenarios 4–13, on the REST endpoint and on `/publictravelers/list` (SC-004: every returned traveler satisfies all filters and no matching traveler is missing)

**Checkpoint**: US1 and US2 together give a complete, filterable JSON API.

---

## Phase 5: User Story 3 — Download the list as CSV (Priority: P2)

**Goal**: The same list, filters, and order as CSV, with escaping and spreadsheet-formula protection, through both endpoints.

**Independent Test**: quickstart.md §3 scenarios 16–19, plus opening the file in a spreadsheet application.

### Implementation for User Story 3

- [ ] T025 [P] [US3] In `lib/csv.js` add and export `neutralizeFormula(value)` (a string beginning with `=`, `+`, `-`, `@`, tab, or carriage return gets a leading single quote; non-strings, numbers, `null`, and `undefined` are returned unchanged) and `toSafeCsvRow(values)` (neutralize each value, then delegate to the existing `toCsvRow`). Do **not** change `escapeCsvValue` or `toCsvRow`, so the feature 001 export is unaffected (FR-012)
- [ ] T026 [US3] In `test/lib/csv-test.js` add tests: each trigger character is prefixed; a plain string, a number, and an empty value are untouched; `toSafeCsvRow(['=SUM(A1), "draft"', 5])` yields `"'=SUM(A1), ""draft""",5`; and existing behavior is unchanged (`escapeCsvValue('=1')` is still `=1`)
- [ ] T027 [US3] In `lib/public-travelers.js` extend `parseListQuery` with `format` (`json` default or `csv`, case-insensitive, else 400 `format must be json or csv`), and add `CSV_COLUMNS` (order per contract: `_id, title, status, createdBy, createdOn, updatedBy, updatedOn, archivedOn, owner, tags, totalInput, finishedInput, subsystem, device, activity, machineArea, sector, windchillId`) and `toCsv(records, options)`: header row, then one `toSafeCsvRow` per record, with tags joined by `;`, dates as ISO 8601 UTC (`''` when null), `statusCode` omitted, `\n` line endings, and a leading `﻿` only when `options.bom` is true. No records → header only (FR-008, FR-010, FR-011, FR-014)
- [ ] T028 [US3] In `lib/public-travelers.js` extend `listHandler` with the CSV branch: when `format` is `csv`, call `list` (un-paged when neither `page` nor `limit` was given, so the items pipeline has no skip/limit), then respond `200` with `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="public-travelers-YYYYMMDD.csv"` (request date, UTC), and the `toCsv(travelers, {bom: options.bom})` body. Errors stay JSON (FR-013)
- [ ] T029 [US3] In `routes/traveler.js` change the `/publictravelers/list` mount to `publicTravelers.listHandler(Traveler, {bom: true})`, so only the web-app download carries the UTF-8 BOM; leave the REST mount in `routes/api.js` without it (research D10)
- [ ] T030 [US3] In `test/lib/public-travelers-test.js` add tests for `toCsv` (header order matches the contract, no records gives the header only, comma/quote/newline escaping, formula neutralization on a title, tags joined with `;`, ISO dates, null dates empty, `statusCode` absent, BOM present only with `bom: true`) and for the handler's CSV branch as real HTTP with the T014 helper (`Content-Type` and `Content-Disposition` headers, a body that starts with the header row, un-paged when no `page`/`limit`, paged when `limit` is given, a leading BOM only when the handler is created with `{bom: true}`, `format=xml` → 400 JSON error)
- [ ] T031 [P] [US3] Extend `views/docs/api/public-travelers.md` with the CSV format: `format=csv`, the column list, paging behavior (un-paged returns everything), tag separator, timestamp format, and formula protection
- [ ] T032 [US3] Validate User Story 3 per `specs/004-public-traveler-dashboard/quickstart.md` §3 scenarios 16–19, and open the downloaded CSV in a spreadsheet application to confirm columns align, the comma/quote title stays in one cell, and the `=SUM…` title shows as text (SC-006)

**Checkpoint**: The full API (US1–US3) is complete and documented.

---

## Phase 6: User Story 4 — Browse public travelers on a dashboard (Priority: P2)

**Goal**: Replace the public travelers page with a dashboard that reads only from `/publictravelers/list`, with a filter bar, a paged table, CSV download, and the existing bulk actions.

**Independent Test**: quickstart.md §4 steps 1, 2, and 4–12, plus §5 regression checks.

**Depends on**: US1 (data), US2 (filters), US3 (CSV download).

### Implementation for User Story 4

- [ ] T033 [US4] Rewrite `views/public-travelers.jade` per `contracts/dashboard-ui.md`, keeping `extends layout`, the `block head` stylesheet links, and the existing `block js` script includes. Body: `.btn-toolbar` with Generate report (`#report`), Add to binder (`#add-to-binder`), and Download CSV (`#download-csv`), and **no** Select all or Select none buttons (rows are selected with their own checkboxes); `#message`; a filter bar with `#f-updated-from`, `#f-updated-to` (date inputs), `#f-subsystem`, `#f-device`, `#f-activity`, `#f-machine-area`, `#f-sector`, `#f-windchill-id`, `#f-tags` (text), `#f-include-archived` (checkbox), `#apply-filters`, `#clear-filters`; `table#public-travelers-table`; a footer with `#range-info`, `select#page-size` (10, 25 selected, 50, 100), `#prev-page`, `#next-page`; and keep the existing `#modal` and `form#report-form`. Do not keep the old `#publictravelers.table.active` wrapper; no handler will depend on it. Use the Bootstrap 2 grid (`row-fluid`, `span*`) as in `views/ncr-dashboard.jade` on `upton` (FR-025, FR-026, FR-027)
- [ ] T034 [US4] Rewrite `public/javascripts/public-travelers.js`, part 1 (table): keep it a module importing `./lib/binder.js` and keep the `ajax-helper.js` setup calls `updateAjaxURL(prefix)` and `disableAjaxCache()`, but drop `ajax401` (errors are handled in T036). Initialize `#public-travelers-table` as a **row container only**: `bPaginate: false, bFilter: false, bSort: false, bInfo: false, bAutoWidth: false, sDom: 't'`, `oLanguage.sEmptyTable` = `No public travelers match the current filters.`, with a `fnDrawCallback` running `Holder.run({images: 'img.user'})`. Columns in the contract order: reuse `selectColumn`, `tagsColumn`, `ownerColumn`, `createdByColumn`, `createdOnColumn` and `personColumn('Updated by', 'updatedBy')` from `table.js`; add local columns for title (a link to `prefix + '/travelers/' + _id + '/'` using `target="${linkTarget}"`, the global that `views/layout.jade` defines from `viewConfig.linkTarget`), status badge (colored by status name), progress (bar with `finished/total` label, `—` when `totalInput` is 0), subsystem, device, activity, machine area, sector, Windchill ID, updated on (`—` when null), and archived on (hidden unless include-archived is checked, via `fnSetColumnVis`). Add an `escapeHtml` helper and use it on every user-authored value in the local columns (FR-027)
- [ ] T035 [US4] In `public/javascripts/public-travelers.js`, part 2 (loading and paging): keep state `{page, limit: 25}`; `buildQuery()` maps the filter-bar controls to the contract's parameters (`updatedFrom`, `updatedTo`, the six text filters, `tags`, `includeArchived`, `page`, `limit`), omitting blanks; `load()` calls `$.getJSON('/publictravelers/list?' + query)` with an incrementing sequence number so only the newest response renders, replaces the rows with `fnClearTable()` + `fnAddData(travelers)`, and sets `#range-info` (`26–50 of 132`, or `0 travelers`) and the Previous/Next disabled states from `total`, `page`, and `limit`. Wire Apply (reset to page 1, load), Clear (empty all controls, page 1, load), Previous/Next, and `#page-size` (reset to page 1); toggling include-archived also updates the archived column visibility and reloads (FR-026, FR-027)
- [ ] T036 [US4] In `public/javascripts/public-travelers.js`, part 3 (states and actions): show a loading row while a request is in flight; on failure, write an alert into `#message` (`responseJSON.error` for a 400, "please sign in again" for a 401 or a non-JSON login redirect, a generic message otherwise) with a **Retry** button that calls `load()`, leaving the previous rows in place; keep the report handler (post selected `_id`s into `#report-form`, show the existing no-selection modal when none), `#add-to-binder` (`AddBinder.addModal`), and `selectEvent()`, all reaching the table with `$('#public-travelers-table').dataTable()` instead of the old `$('.table.active table')`; do not carry over the select-all and deselect-all handlers, since those buttons are gone; add `#download-csv`, which sets `window.location` to `prefix + '/publictravelers/list?format=csv&' + <current filters>` with **no** `page` or `limit` (FR-029, FR-030, FR-031)
- [ ] T037 [US4] In `routes/traveler.js` delete the now-unused `GET /publictravelers/json` route, keeping `GET /publictravelers/` with `routesUtilities.getRenderObject(req)`. Then run `grep -rn "publictravelers/json" --include='*.js' --include='*.jade' .` (excluding `node_modules` and `specs/`) and confirm nothing references it (FR-025)
- [ ] T038 [US4] Validate User Story 4 per `specs/004-public-traveler-dashboard/quickstart.md` §4 steps 1, 2, and 4–12 (skip the status-card steps until Phase 7) and §5 (old endpoint now 404, `/apis/travelers/` unchanged, `/docs/` shows the new API section). Also confirm SC-007 (a specific traveler is findable by combining filters in under 30 seconds without leaving the page) and SC-008 (Generate report and Add to binder both still work on rows selected with their checkboxes)

**Checkpoint**: The dashboard works end to end without status cards.

---

## Phase 7: User Story 5 — See status totals at a glance (Priority: P3)

**Goal**: Status summary cards with counts that also filter the table.

**Independent Test**: quickstart.md §4 steps 1, 3, and 5, plus SC-009.

**Depends on**: US4 (the page) and the `statusCounts` already returned by US1.

### Implementation for User Story 5

- [ ] T039 [US5] In `views/public-travelers.jade` add the `#status-summary` container above the filter bar and an inline `style.` block modeled on `views/ncr-dashboard.jade` (`.status-card`, `.status-card.active`, `.status-card .count`), with one background color per status (initialized, active, submitted for completion, completed, frozen, archived) (FR-028)
- [ ] T040 [US5] In `public/javascripts/public-travelers.js` render the cards from `statusCounts` on every load: an **All** card whose count is the sum of the counts shown, then one card per status, with the **archived** card present only while include-archived is checked. Clicking a card sets `state.status`, resets to page 1, highlights it, and reloads (clicking All or the active card clears it); send `status` in `buildQuery()`. The counts must not change when a status is selected. Unchecking include-archived while the archived card is selected clears the selection. Reuse the same color map for the status badge column from T034 (FR-028)
- [ ] T041 [US5] Validate User Story 5 per `specs/004-public-traveler-dashboard/quickstart.md` §4 steps 1, 3, and 5: card counts, selecting a card narrows the table and keeps other counts, counts sum to All for several filter combinations (SC-009), and the archived card appears only with the checkbox

**Checkpoint**: All five user stories are functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T042 [P] Add `public-travelers.js` to the "Shared libraries (`/lib/`)" list in `CLAUDE.md`, with one line describing it (shared listing used by the web route and the REST route)
- [ ] T043 Run `npx eslint lib/public-travelers.js lib/csv.js lib/req-utils.js routes/traveler.js routes/api.js public/javascripts/public-travelers.js test/lib/public-travelers-test.js test/lib/csv-test.js test/lib/req-utils-test.js` and `npx prettier --write` on the same files plus `views/docs/api/public-travelers.md`; fix all findings (functions stay under the complexity limit of 20 by keeping parse, build, and format steps separate)
- [ ] T044 Run `npx mocha test/lib/public-travelers-test.js test/lib/csv-test.js test/lib/req-utils-test.js` and confirm everything passes
- [ ] T045 Re-run the SC-001 timing from T018 with everything built: page 1, a filtered page, and un-paged CSV (`format=csv`) on the 5,000-traveler data set, each under 3 seconds (SC-001), and confirm no "Sort exceeded memory limit" in the log. If it fails, apply the escape hatch in `research.md` D4/D5 instead of adding an ad-hoc index
- [ ] T046 Security pass over the diff in `lib/public-travelers.js`, `lib/csv.js`, `routes/traveler.js`, `routes/api.js`, `lib/req-utils.js`, and `public/javascripts/public-travelers.js`: no non-public traveler can appear (`publicAccessMatch()` is applied unconditionally in `buildBaseMatch`), object-valued query parameters are rejected, every user-authored value in the dashboard is escaped, CSV formula protection is on for all text cells, no `console.log`, and error responses never echo internal messages (SC-005). Optionally run `/security-review`
- [ ] T047 Run the whole of `specs/004-public-traveler-dashboard/quickstart.md` end to end (§1–§6) on a clean seed and record any deviations

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks every story
- **US1 (Phase 3)**: after Foundational; no dependency on other stories
- **US2 (Phase 4)**: after US1 (extends its parsing, match, and pipelines)
- **US3 (Phase 5)**: after US1; independent of US2's logic, though it edits the same `lib/public-travelers.js`, so do it after or carefully merged with US2
- **US4 (Phase 6)**: after US1, US2, and US3 (its filter bar needs the filters and its Download CSV button needs CSV)
- **US5 (Phase 7)**: after US4 (and uses `statusCounts` from US1 and the `status` filter from US2)
- **Polish (Phase 8)**: after the stories you intend to ship

### Within a story

Lib parsing → lib match/pipelines → lib `list`/handler → tests → route mounts → docs → validation. Tasks that edit `lib/public-travelers.js` or `test/lib/public-travelers-test.js` are sequential with each other.

### Parallel opportunities

- **T015, T016, T017** (web route, REST route, API docs) touch three different files.
- **T025** (`lib/csv.js`) can run alongside US2's lib work (T019–T021), since it is a different file.
- **T023, T031** (docs) can run alongside the tests for their story.
- **T042** (CLAUDE.md) is independent of everything else.
- With two people, once the endpoint contract is agreed (it is: `contracts/public-travelers-list.md`), one can start the dashboard view (T033) while the other finishes US2/US3 in the lib.

### Parallel example: User Story 1 routes and docs

```text
# After T014 passes, launch together (different files):
Task: "T015 Mount /publictravelers/list in routes/traveler.js"
Task: "T016 Mount /apis/publictravelers/ in routes/api.js"
Task: "T017 Create views/docs/api/public-travelers.md and include it in views/docs/api.jade"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 → Phase 2 → Phase 3 (T001–T018).
2. **Stop and validate**: run the US1 scenarios against a real MongoDB. This is also the first real-database check of the aggregation pipelines, and the SC-001 timing at 5,000 travelers, so treat T018 as a gate.
3. Demo or ship the paged JSON API if useful.

### Incremental delivery

1. MVP (US1) → add US2 (filters) → add US3 (CSV): **a complete, documented API**, shippable before any UI work.
2. Add US4 (dashboard) → add US5 (status cards).
3. Polish, the final performance re-check (the first timing runs at the US1 gate), and the security pass last.

### Risks to watch

- **Pipeline behavior on a real database** (T018 is the first check; the environment used for planning had no MongoDB): the computed sort key, the date-range `$or`, the effective-status `$group`, and regex matching on tags.
- **Removing `/publictravelers/json` too early** would break today's page; it is deliberately last (T037).
- **DataTables as a row container** (T034–T036): the shared selection helpers and the binder modal depend on it, so verify report and add-to-binder explicitly in T038.

## Notes

- [P] tasks touch different files and have no dependency on an incomplete task
- Commit after each task or logical group; stop at any checkpoint to validate that story on its own
- Avoid: two tasks editing `lib/public-travelers.js` at once, and any change to `escapeCsvValue`/`toCsvRow` (feature 001 relies on them)
