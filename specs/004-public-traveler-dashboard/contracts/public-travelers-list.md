# Contract: Public Traveler Listing

Two endpoints, one shared implementation (`lib/public-travelers.js`, see
[research D1](../research.md)). They accept the same query parameters and return the same data;
they differ only in mount point, authentication, and one CSV byte (see below). Field semantics,
defaults, and validation live in [`../data-model.md`](../data-model.md) and are not repeated in
full here.

| | Web app | REST API |
|---|---|---|
| Method and path | `GET /publictravelers/list` | `GET /apis/publictravelers/` |
| Mounted in | `routes/traveler.js` | `routes/api.js` |
| Authentication | Session (`auth.ensureAuthenticated`) | HTTP Basic (`auth.basicAuth`, applied to the whole API server) |
| Audience | The dashboard and signed-in users | External systems and scripts |
| CSV byte order mark | Yes (UTF-8 BOM, so Excel reads UTF-8) | No |

Neither endpoint modifies data. The old `GET /publictravelers/json` is removed
([research D2](../research.md)). The existing `GET /apis/travelers/` is unchanged. Adding the
REST endpoint is additive, which satisfies the "REST API stays backward-compatible" rule.

## Request

Query parameters (all optional):

| Parameter | Example | Notes |
|---|---|---|
| `format` | `csv` | `json` (default) or `csv`. |
| `page` | `2` | Integer ≥ 1. Default 1. |
| `limit` | `50` | Integer ≥ 1. Default 25, maximum 500 (larger is reduced to 500). |
| `updatedFrom` | `2026-09-01` | Inclusive lower bound on the update time. Date or ISO 8601 timestamp. |
| `updatedTo` | `2026-09-15` | Inclusive upper bound. A date includes the whole day. |
| `subsystem` | `cryo` | Case-insensitive partial match. Same for `device`, `activity`, `machineArea`, `sector`, `windchillId`. A traveler with no `device` of its own is shown, and found by the `device` filter, through its older list of devices (its names joined with `/`). |
| `status` | `active,completed` | Names or codes; comma-separated or repeated (`status=active&status=1.5`). |
| `tags` | `leak-check,vacuum` | Whole tag labels; every tag must be present. Comma-separated or repeated. |
| `includeArchived` | `true` | Also list archived travelers. Filtering on `status=archived` implies it. |

Blank values are ignored. Values must be strings; bracketed or nested values (for example
`subsystem[$ne]=x`) are rejected with 400.

Ordering is fixed: most recently updated first (a traveler never edited sorts by its creation
time), ties broken by id so paging is repeatable.

## Response: JSON (`200`, `Content-Type: application/json`)

```json
{
  "travelers": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "title": "Cryomodule leak check",
      "status": "active",
      "statusCode": 1,
      "createdBy": "liud",
      "createdOn": "2026-08-30T14:02:11.000Z",
      "updatedBy": "smith",
      "updatedOn": "2026-09-14T09:41:03.000Z",
      "archivedOn": null,
      "owner": "liud",
      "tags": ["leak-check", "vacuum"],
      "totalInput": 36,
      "finishedInput": 12,
      "subsystem": "Cryogenics",
      "device": "CM-02",
      "activity": "Acceptance test",
      "machineArea": "Linac tunnel",
      "sector": "S4",
      "windchillId": "WC-0012345"
    }
  ],
  "page": 1,
  "limit": 25,
  "total": 132,
  "statusCounts": {
    "initialized": 12,
    "active": 70,
    "submitted for completion": 9,
    "completed": 33,
    "frozen": 8
  }
}
```

- `total` counts travelers matching **every** filter, including `status`. `statusCounts` ignores
  the `status` filter, so a client can show every status total while one status is selected.
  Without a `status` filter, `total` equals the sum of `statusCounts`.
- `statusCounts` includes `"archived"` only when archived travelers are included (see
  `includeArchived`).
- `limit` is the page size actually applied.
- A page beyond the last returns `travelers: []` with the correct `total`.
- A traveler with no recorded status is reported, filtered, and counted as `initialized`, so
  `total`, the pages, and `statusCounts` always agree.

## Response: CSV (`200`)

Headers:

| Header | Value |
|---|---|
| `Content-Type` | `text/csv; charset=utf-8` |
| `Content-Disposition` | `attachment; filename="public-travelers-YYYYMMDD.csv"` (date of the request, UTC) |

Body: one header row, then one row per traveler, in the same order as the JSON output. Columns,
in this fixed order:

`_id, title, status, createdBy, createdOn, updatedBy, updatedOn, archivedOn, owner, tags,
totalInput, finishedInput, subsystem, device, activity, machineArea, sector, windchillId`

- Missing values are empty cells. `tags` are joined with `;`. Timestamps are ISO 8601 UTC.
  `statusCode` is not included in CSV.
- Escaping follows RFC 4180 (commas, double quotes, and line breaks keep a value in one cell).
- A text value beginning with `=`, `+`, `-`, `@`, a tab, or a carriage return is prefixed with a
  single quote so a spreadsheet shows it as text.
- Without `page` and `limit`, every matching traveler is returned. With either, only that page.
- No matches: the header row only.
- The web-app endpoint prepends a UTF-8 byte order mark; the REST endpoint does not.

Example (two rows, the second showing escaping and formula neutralization):

```csv
_id,title,status,createdBy,createdOn,updatedBy,updatedOn,archivedOn,owner,tags,totalInput,finishedInput,subsystem,device,activity,machineArea,sector,windchillId
64f1a2b3c4d5e6f7a8b9c0d1,Cryomodule leak check,active,liud,2026-08-30T14:02:11.000Z,smith,2026-09-14T09:41:03.000Z,,liud,leak-check;vacuum,36,12,Cryogenics,CM-02,Acceptance test,Linac tunnel,S4,WC-0012345
64f1a2b3c4d5e6f7a8b9c0d2,"'=SUM(A1), ""draft""",completed,smith,2026-09-01T08:00:00.000Z,,,,smith,,10,10,,,,,,
```

## Errors

Errors are JSON, `{ "error": "<message>" }`, whatever `format` was requested.

| Status | Condition | Example message |
|---|---|---|
| `400` | Invalid `page` / `limit` | `page must be an integer between 1 and 100000`, `limit must be a whole number of 1 or more` |
| `400` | Unparseable date, or `updatedFrom` after `updatedTo` | `updatedFrom must be a date (YYYY-MM-DD) or an ISO 8601 timestamp` |
| `400` | Unknown `status` value | `unknown status "done"; use one of: initialized, active, submitted for completion, completed, frozen, archived (or codes 0, 1, 1.5, 2, 3, 4)` |
| `400` | Unknown `format`, invalid `includeArchived`, over-long text filter, a non-string value, or a value with a null character | `format must be json or csv`, `subsystem must not contain a null character` |
| `401` (REST) | Missing or unknown credentials | Empty body, `WWW-Authenticate: Basic realm="api"` |
| redirect (web) | No session | Standard login redirect from `auth.ensureAuthenticated` |
| `500` | Unexpected failure | `{ "error": "internal error" }`; details go to the application log only |

No partial data is returned with an error.

## Access rules

- Only travelers with public read or write access are ever returned, for every caller including
  owners and admins (they see non-public travelers through the existing lists). A traveler with no
  stored public-access value counts as public when the application's configured default for new
  travelers is read or write, exactly as it does everywhere else in the application; a stored
  "none" (or `null`) is never listed.
- The visibility rule is one shared helper (`publicAccessMatch()` in `lib/req-utils.js`, next to
  `getAccess`), applied inside the shared library; neither route can widen it, and no query
  parameter can change it.

## Examples

```
GET /apis/publictravelers/?status=active&subsystem=cryo&updatedFrom=2026-09-01&limit=50
GET /apis/publictravelers/?format=csv&tags=leak-check,vacuum
GET /publictravelers/list?page=3&limit=25&includeArchived=true
GET /publictravelers/list?format=csv&updatedFrom=2026-09-01&updatedTo=2026-09-15
```
