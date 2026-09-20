# Quickstart: Validating the Public Traveler Listing API & Dashboard

Runnable checks that prove the feature works end to end. Endpoint and field details are in
[contracts/public-travelers-list.md](contracts/public-travelers-list.md) and
[data-model.md](data-model.md); this guide only says what to run and what to expect.

## Prerequisites

- MongoDB reachable and the app configured (`../etc/traveler-config/`, or the path in
  `TRAVELER_CONFIG_REL_PATH`). Web app default port `3001`, REST API default port `3443`
  (`config/app_change.json`, `config/api_change.json`); yours may differ.
- An API user from `api_users` in the API config (see `views/docs/api/auth.md`), and a signed-in
  browser session for the dashboard.
- Start the app with `node app.js` (or `npx nodemon`).

In the commands below, `$API` is `https://<host>:<api-port>` with `-u <api-user>:<password>`, and
`$WEB` is `https://<host>:<web-port>` (browser session).

## 1. Unit and smoke tests (no database needed)

```bash
npx mocha test/lib/public-travelers-test.js test/lib/csv-test.js test/lib/req-utils-test.js
npx eslint lib/public-travelers.js routes/traveler.js routes/api.js public/javascripts/public-travelers.js
npx prettier --check "lib/public-travelers.js" "test/lib/public-travelers-test.js"
```

Expected: all pass, with no lint errors. The new test file covers query parsing and validation,
pipeline construction, record mapping (effective status, owner fallback, `archivedOn` rule), CSV
escaping and formula neutralization, `list` against a fake model, and the handler smoke tests.

> `npx mocha test/lib/` (the whole directory) fails **before and after** this feature on
> `test/lib/ldap-client-test.js` (`Cannot find module '../../config/ad.json'`, a git-ignored
> config file). That is unrelated; run files explicitly as above.

## 2. Seed data

Use the database named in `mongo.json`; the collection is `travelers`. Insert travelers covering
these cases (only the fields that matter are listed; leave the rest at their defaults):

| # | title | publicAccess | status | archived | Notes |
|---|---|---|---|---|---|
| A | `Leak check A` | 0 | 1 | false | subsystem `Cryogenics`, device `CM-02`, tags `leak-check`,`vacuum`, `updatedOn` = 2026-09-14 |
| B | `Leak check B` | 1 | 2 | false | subsystem `CRYO-2`, `windchillId` `WC-0012345`, `updatedOn` = 2026-09-05 |
| C | `Never edited` | 0 | 0 | false | **no `updatedOn`**, `createdOn` = 2026-09-19 (newest) |
| D | `Private` | -1 | 1 | false | must never appear |
| E | `Old archived` | 0 | 2 | **true** | `archivedOn` set |
| F | `Status four` | 0 | 4 | false | archived by status, no flag |
| G | `=SUM(A1), "draft"` | 0 | 2 | false | formula + comma + quote in the title |
| H | `Legacy` | 0 | 1 | false | **no** subsystem/device/etc. and no `owner` |

Then add 60 more public, non-archived travelers with distinct `updatedOn` values for paging
(a short `mongosh` loop that runs `db.travelers.insertMany(...)` is enough).

## 3. Scenarios

Each scenario lists the spec item it proves.

| # | Run | Expect |
|---|---|---|
| 1 | `curl $API/apis/publictravelers/` | 200 JSON `{travelers,page:1,limit:25,total,statusCounts}`. **C** is first (newest by creation time); **D**, **E**, **F** absent; every record has all keys (US1, SC-002, SC-005). |
| 2 | Page through the 60+ set at `limit=25` (`page=1,2,3…`) | Pages hold 25, 25, remainder; no traveler repeats or is skipped; order is descending by update time (US1, SC-003). |
| 3 | `page=999` | 200, `travelers: []`, correct `total` (US1). |
| 4 | `updatedFrom=2026-09-01&updatedTo=2026-09-15` | Only travelers updated in that window, including **A** (14 Sept) and **B**; the end date's whole day counts (US2). |
| 5 | `subsystem=cryo` | **A** and **B**, whatever the case (US2). |
| 6 | `status=active`, `status=1`, `status=completed,active` | Same set for the first two; the third is the union (US2). |
| 7 | `tags=leak-check,vacuum` | Only **A** (needs both); `tags=vacuum` matches case-insensitively (US2). |
| 8 | `subsystem=cryo&status=completed` | Only **B** (filters AND together) (US2). |
| 9 | `windchillId=wc-0012` | **B** (partial, case-insensitive) (US2). |
| 10 | `includeArchived=true` and `status=archived` | **E** and **F** appear; **E** has `archivedOn`, **F** has `archivedOn: null`; both report `status: "archived"` (US2, research D3). |
| 11 | Without `includeArchived`, check `statusCounts` | No `archived` key. With it, `archived` is present and the counts sum to `total` (FR-022, SC-009). |
| 12 | `subsystem=(` , `subsystem=.*` | 200, treated as literal text, no error (FR-020). |
| 13 | `subsystem[$ne]=x` , `limit=0` , `page=abc` , `status=done` , `updatedFrom=nope` , `updatedFrom=2026-09-15&updatedTo=2026-09-01` , `format=xml` | Each returns 400 with a `{error}` message naming the problem (FR-021). |
| 14 | `limit=9999` | 200 and `limit` is `500` in the response (FR-004). |
| 15 | `curl $API/apis/publictravelers/` with no credentials | 401 with `WWW-Authenticate: Basic realm="api"`, no data (FR-023). |
| 16 | `format=csv` | 200 `text/csv`, `Content-Disposition` attachment, header row then all matching travelers (no `page`/`limit` → everything); **G**'s title appears as `"'=SUM(A1), ""draft"""` (US3, FR-012/13). |
| 17 | `format=csv&page=2&limit=5` | Only that page's five rows (FR-013). |
| 18 | `format=csv&subsystem=nomatch` | Header row only (US3). |
| 19 | Same query from `$WEB/publictravelers/list` (signed in) | Same records as the REST call; the CSV differs only by a leading BOM (FR-023). |
| 20 | **H** in JSON | `subsystem`, `device`, `activity` etc. are `""`, and `owner` equals `createdBy` (data-model). |
| 21 | Set a traveler to `publicAccess: -1` | It disappears from the next request. |

Open the CSV in Excel or Numbers: columns align, the comma/quote title stays in one cell, and
**G** displays as text rather than a formula (SC-006).

## 4. Dashboard walkthrough (signed in)

Open `$WEB/publictravelers/`.

1. First page shows newest-first rows, a status card row, the filter bar, and a range such as
   `1–25 of 68` (US4-1, US5-1).
2. Type `cryo` in Subsystem and Apply: the table refreshes in place with no page reload, the range
   resets to page 1, and the card counts change (US4-2).
3. Click the **active** card: it highlights and the table narrows; the other cards keep their
   counts (US5-2/3). The counts add up to **All** (SC-009).
4. Clear: everything resets (US4-3). Previous/Next behave and disable at the ends (US4-4).
5. Tick **Include archived**: the archived card and the "archived on" column appear, and **E**/**F**
   show (US4-8).
6. Click a title: the traveler opens (US4-5).
7. **Download CSV** with a filter active: the file holds all matching rows, not just the visible
   page (US4-6, FR-029).
8. Select a few rows, then **Generate report** and **Add to binder**: both work as before; with
   nothing selected the existing alert appears. **Select all/none** act on the visible rows
   (US4-7, SC-008).
9. Stop the server (or block the request) and Apply a filter: an error with a Retry control
   appears and the table isn't blanked (US4-9).
10. Apply a filter that matches nothing: "No public travelers match the current filters." appears
    (US4-10).
11. Rapidly change filters several times: the final table matches the final filters (stale
    responses are discarded).
12. Insert a traveler whose title is `<img src=x onerror=alert(1)>` and reload: it shows as text,
    with no script running (escaping).

## 5. Regression checks

- `GET $API/apis/travelers/` still returns the same array as before (backward compatibility).
- `GET $WEB/publictravelers/json` now returns 404 (retired on purpose, research D2); the link on
  the travelers page (`/publictravelers/`) still works.
- The API section of the `/docs/` page lists the new endpoint (a new `public-travelers` section
  next to the existing traveler-list section).
- Feature 001 (`/travelers/:id/csv`) and feature 003 pages are unchanged.

## 6. Performance (SC-001)

With roughly 5,000 public travelers loaded (a `mongosh` loop that clones a representative
document; include realistic embedded `forms` so document size is representative):

- `time curl` for page 1, a filtered page, and `format=csv` with no paging should each finish in
  under 3 seconds.
- Watch the server log during the run for "Sort exceeded memory limit" errors; there should be
  none.

If this fails, the escape hatch is in [research D4/D5](research.md): persist `updatedOn` at
creation and add an index.
