# Research: Public Traveler Listing API & Dashboard

Phase 0 findings. The Technical Context had no unresolved unknowns, but the spec deferred three
items to planning (archived mapping, old endpoint, exposure across two servers). Research also
turned up several facts in the existing code that change the design. Each decision below is
grounded in the code as it exists on the `Ernest` branch.

## D1 — One shared library, two thin route wrappers

- **Decision**: Put all listing behavior in a new `lib/public-travelers.js`. It has no dependency
  on a specific server and receives the Traveler model as an argument. Export an Express handler
  factory, `listHandler(Traveler, options)`. Mount it once in `routes/traveler.js` (web app,
  session auth) and once in `routes/api.js` (REST API, basic auth).
- **Rationale**: Constitution III forbids sharing route files across the two servers but
  requires shared logic to live in `/lib/`. A handler factory removes the ~25 duplicated lines
  (parse → list → format → map errors) that two hand-written routes would otherwise carry, and it
  guarantees FR-023 (identical results for both audiences). Passing the model in keeps the module
  loadable and testable without a database connection.
- **Alternatives considered**:
  - *Web route only, REST calls it internally*: violates Principle III.
  - *Duplicate the logic in both route files*: guaranteed drift, and forbidden by the "shared
    logic belongs in lib" rule.
  - *Dashboard only, no REST endpoint*: contradicts the request for an "API" and spec FR-023.

## D2 — Endpoints and retiring the old one

- **Decision**:
  - Web app: `GET /publictravelers/list` (new). The page stays at `GET /publictravelers/`.
  - REST API: `GET /apis/publictravelers/` (new, additive).
  - Remove `GET /publictravelers/json`.
- **Rationale**: A grep shows the only consumer of `/publictravelers/json` is
  `public/javascripts/public-travelers.js`, which is being rewritten. The endpoint returns whole
  traveler documents, including embedded forms, which is heavy and exposes far more than the page
  shows. It is a web-app endpoint, not part of the REST API, so the "REST API must stay
  backward-compatible" rule does not apply. The existing `/apis/travelers/` is untouched, so
  existing API clients are unaffected. The page path is unchanged, so `views/travelers.jade`'s
  link and bookmarks keep working (FR-025).
- **Alternatives considered**:
  - *Reuse `/publictravelers/json` with a new response shape*: silently breaks any unknown
    consumer with a confusing shape change instead of a clear 404, and `?format=csv` on a path
    ending in `json` reads badly.
  - *Keep the old endpoint alongside*: leaves a heavy, unfiltered endpoint that nothing uses.
  - *`/api/publictravelers` on the web app, as on `upton`*: `/api` is already a web-app route that
    renders the API docs page, so a sibling prefix would confuse the two audiences.

## D3 — What "archived" means (spec item settled)

- **Decision**: A traveler is archived when `archived === true` **or** `status === 4`. For
  listing purposes its **effective status** is `archived` (code 4) regardless of its stored
  status. `archivedOn` is reported only when the `archived` flag is true.
- **Rationale**:
  - `routes/traveler.js` (`/archivedtravelers/json`) already defines archived as
    `{$or: [{archived: true}, {status: 4}]}`, so this reuses the established rule.
  - `PUT /travelers/:id/archived` sets the flag and `archivedOn` but never changes `status`.
    Only an explicit status change reaches status 4. Grouping by raw `status` would therefore
    file an archived-flag traveler under "completed" or "active", making the status cards
    contradict the "archived" card and the include-archived option.
  - The same route sets `archivedOn` on archive and never clears it on unarchive, so a stale
    date can sit on a live traveler. The spec's Assumptions said "has an archive date"; that is
    wrong and is corrected in the spec as part of this plan.
- **Behavior change to note**: today's public page excludes only `archived: true`. A traveler
  with `status: 4` and no flag is currently listed there. Under this rule it is hidden unless
  archived travelers are included. This is intended and matches the spec.
- **Alternatives considered**: *Group by raw status and show an "archived" boolean separately*.
  Rejected because SC-009 (cards sum to All) cannot hold when one traveler can be both
  "completed" and archived.

## D4 — Query engine: aggregation with a computed sort key

- **Decision**: Use `Traveler.aggregate()` (Mongoose 5.13.13) with `allowDiskUse(true)` instead of
  `find()`. Two pipelines run in parallel:
  1. **Items**: `$match` (all raw-field filters) → `$project` (only the needed fields plus
     `_sortKey = ifNull(updatedOn, createdOn)`) → `$sort {_sortKey:-1, _id:-1}` → `$skip` →
     `$limit`. The CSV-without-paging path omits skip/limit.
  2. **Counts**: `$match` (every filter except status) → `$group` by effective status. The
     result gives `statusCounts` directly, and `total` is the sum of the counts for the requested
     statuses (or all of them when no status filter is set). No third query is needed.
- **Rationale**:
  - **Sort key.** Both creation paths, `createTraveler` (`utilities/routes.js`) and
    `cloneTraveler` (`routes/traveler.js`), set `createdOn` but not `updatedOn`, so a traveler
    nobody has edited has no `updatedOn`. A plain
    `updatedOn` sort would put every brand-new traveler last, contradicting FR-003. `find()`
    cannot sort on a computed value.
  - **Memory.** Traveler documents embed full form HTML. A blocking sort over unprojected
    documents can exceed MongoDB's in-memory sort limit. Projecting before sorting keeps the sort
    working set small, and `sort` + `skip` + `limit` lets the server keep only the top
    `skip + limit` entries.
  - **Date range.** Expressed on raw fields as
    `{$or: [{updatedOn: {$gte, $lte}}, {updatedOn: null, createdOn: {$gte, $lte}}]}` so the
    whole filter stays in one early `$match`. `{updatedOn: null}` matches missing and null.
  - **Typing.** Aggregation does not cast values against the schema, so the lib builds every
    value with the right type itself (Date objects, numbers). That is also what makes the
    injection defence in D6 straightforward.
- **Alternatives considered**:
  - *`find().sort({updatedOn:-1})`*: wrong ordering for never-updated travelers.
  - *Backfill `updatedOn` from `createdOn` with a migration, and set it at creation*: would let
    an index serve the sort, but writes production data and changes every creation path. Out of
    scope for a read-only feature. Recorded as the escape hatch if performance ever demands it.
  - *A single `$facet`*: its output is one document capped at 16 MB, and blocking-sort disk use
    inside a facet is less certain than in a top-level stage. Two small parallel aggregations are
    simpler and safer.
  - *A separate `countDocuments`*: the group stage gives the total and the status counts for the
    same scan, so it costs less than a count plus a group.

## D5 — Performance

- **Decision**: No new index. Validate SC-001 in the quickstart with a realistic data volume.
- **Rationale**: The computed sort key cannot use an index, and at the stated volume (a few
  thousand public travelers) a project-then-sort over one collection scan is well inside 3
  seconds. Adding an index would change production collections for no measured need. `default_traveler_public_access` is `0` (public read) in
  `config/app_change.json`, so many deployments have a high public fraction, which the volume
  assumption already covers.
- **Risk / mitigation**: If a deployment holds far more travelers, the escape hatch in D4
  (persist `updatedOn` at creation plus an index) applies. The counts pipeline reads only `status`
  and `archived`, so it is cheap.

## D6 — Filter parsing and safety

- **Decision**: `parseListQuery(query)` validates and normalizes; every value must be a string,
  or an array of strings for `status` and `tags`. Anything else, such as a parsed object like
  `subsystem[$ne]=x`, is rejected with a 400.
  - Text filters (six fields): `{field: {$regex: <escaped>, $options: 'i'}}` using
    `lodash.escapeRegExp`. Maximum length 200.
  - Tags: one `{tags: /^<escaped>$/i}` condition per requested tag, combined with `$and`, so all
    must be present.
  - Status: comma-separated or repeated; each value is a case-insensitive name or a numeric code;
    normalized to codes.
  - Blank strings are dropped, so an empty form field acts as "not supplied" (FR-019).
- **Rationale**: Express's `qs` parser turns bracketed parameters into objects, which would flow
  straight into a Mongo query and allow operator injection. Requiring strings and escaping before
  building regexes closes that, and it also makes special characters literal (FR-020). Escaped
  literals cannot cause pathological regex backtracking.
- **Alternatives considered**: *Mongo text index / `$text`*: word-based, not substring, and
  needs an index. *Exact match*: rejected in the spec because these fields are free text.

## D7 — Dates

- **Decision**: `updatedFrom` / `updatedTo` accept `YYYY-MM-DD` (a whole day in the server's local
  time zone: from = 00:00:00.000, to = 23:59:59.999) or a full ISO 8601 timestamp (used exactly).
  A start later than the end is a 400. Parsing is hand-written with a regex and `Date`, so no
  new dependency is added.
- **Rationale**: This matches the spec's assumption and what `<input type="date">` sends. The
  project already carries moment only on the frontend, and adding a server dependency for two
  parses is not justified.

## D8 — Paging

- **Decision**: `page` (integer ≥ 1, default 1) and `limit` (integer ≥ 1, default 25, maximum 500).
  A limit above 500 is reduced to 500 and the response reports the applied value; non-numeric,
  zero, or negative values are a 400. Page number is capped at 100000 to keep `skip` sane. For
  CSV, if neither `page` nor `limit` is supplied, every matching row is returned; if either is
  supplied the requested page is returned.
- **Rationale**: Mirrors the `page` / `limit` / `total` envelope used by `/api/ncrs` on `upton`,
  so the dashboards read alike. The ordering has a fixed tie-break (`_id`), so paging never
  duplicates or skips when data is unchanged (SC-003).

## D9 — Records, owner, and JSON envelope

- **Decision**: Each record uses the existing API's `_id` for the identifier, so the dashboard's
  report and binder helpers (which read `data._id`) work unchanged. `owner` is
  `owner || createdBy`. `status` is the effective human-readable name and `statusCode` the
  effective number. Missing strings become `''`, missing dates `null`, and missing tags `[]`.
  JSON envelope: `{travelers, page, limit, total, statusCounts}`.
- **Rationale**: `owner || createdBy` is exactly how the system resolves ownership
  (`isOwner` in `lib/req-utils.js`, the archived-travelers route, and the frontend `ownerColumn`).
  Reporting a blank owner for older travelers would be misleading.
- **Note**: `updatedOn` is reported as stored, not back-filled with `createdOn`. A never-edited
  traveler therefore shows a blank "updated" value while still sorting by its creation time.
  The dashboard displays this as "—".

## D10 — CSV details

- **Decision**: Reuse `toCsvRow` from `lib/csv.js` for RFC-4180 escaping. Add a separate
  `neutralizeFormula` (prefix a single quote to strings starting with `=`, `+`, `-`, `@`, tab, or
  carriage return) and a `toSafeCsvRow` that applies it. Timestamps are ISO 8601 UTC. Tags are
  joined with `;`. Headers are the property names, in the order identifier, then the 17
  properties. Only the web-app route asks for a UTF-8 BOM.
- **Rationale**:
  - Changing `escapeCsvValue` would alter the feature 001 export, so the protection is opt-in.
  - ISO timestamps differ from feature 001's Unix-seconds convention on purpose: FR-014 requires
    an unambiguous format with a time zone, and a listing is read by people and by tools.
  - The BOM makes Excel read UTF-8 correctly for the human download from the dashboard; API
    scripts (for example pandas) would see the BOM as part of the first header, so the REST route
    omits it. The data is identical; only that leading byte order mark differs.
- **Observation, out of scope**: the feature 001 export puts user-entered field values through
  `escapeCsvValue` with no formula protection, so it has the same exposure. This plan does not
  change it; it is worth a follow-up.

## D11 — Dashboard construction

- **Decision**: Rewrite `views/public-travelers.jade` and `public/javascripts/public-travelers.js`
  in the NCR-dashboard layout (status cards, filter bar, table, Prev/Next, range indicator), using
  Bootstrap 2 grid classes already in the project. Keep DataTables **only as a row container**
  (paging, filtering, sorting, and the length menu turned off). Paging, page size, and filtering
  are driven by the server through the new endpoint.
- **Rationale**: The row-selection helpers (`selectEvent`, `fnGetSelected`, `fnSelectAll`,
  `fnDeselect`) and the binder modal (`AddBinder.addModal`) call DataTables methods such as
  `fnGetNodes` and `fnGetData`. Keeping a DataTable instance preserves FR-030 with no change to
  those shared helpers, which other pages also use. `upton`'s NCR dashboard uses a plain table
  with inline script; here a static module file follows Constitution V and the existing page.
- **Details**:
  - **Escaping**: all record values are escaped before insertion, because titles, tags, and the
    feature 003 classification fields are user-authored strings and DataTables inserts column
    output as HTML. The reused columns (`ownerColumn`, `tagsColumn`, `createdOnColumn`,
    `updatedOnColumn`, `createdByColumn`) predate this feature; new columns escape explicitly.
  - **Stale responses**: each load carries a sequence number, and only the newest response
    renders, so rapid filter changes cannot show old results.
  - **CSV download**: navigate to `/publictravelers/list?format=csv&<current filters>` with no
    paging parameters, so it returns every matching traveler (FR-029).
  - **Columns dropped**: per-column sorting, sharing, keys, and filled-by columns, per the spec's
    assumption. The status column shows the effective status name; a local column is needed
    because `statusColumn` and `travelerProgressColumn` read a numeric `status`.

## D12 — Documentation and tests

- **Decision**: Add `views/docs/api/public-travelers.md` and include it from
  `views/docs/api.jade` (which the `/docs/` page pulls in through `views/doc-in-one.jade`). Add `test/lib/public-travelers-test.js` (parsing, pipeline building,
  record mapping, CSV, and `list` against a fake model) plus handler smoke tests that call the
  factory's handler with stub `req`/`res` (no supertest needed; the project has none).
- **Rationale**: The constitution requires tests for new `lib/` functions and a happy-path smoke
  test for new routes. The existing tests are dependency-free unit tests run with mocha, and
  the fake-model approach follows that.
- **Environment note**: `npx mocha test/lib/` fails before this feature on
  `test/lib/ldap-client-test.js` (`Cannot find module '../../config/ad.json'`, a git-ignored
  config file). Run the new and related test files explicitly; the quickstart does.

## D13 — Code style constraints

- ESLint parses `ecmaVersion: 2017`, so server code uses no object spread, optional chaining, or
  `??`. The project uses Prettier 1.19, so run `npx prettier --write` on touched files. New lib
  functions stay under the project's complexity limit of 20 by keeping parse, build, and format
  steps separate.
