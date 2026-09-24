# Export traveler data to CSV

Two CSV exports are available:

- **One traveler's collected data** — every field ever filled in on that traveler, plus a
  summary of any files it holds, for sharing or record-keeping.
- **The list of public travelers** — a page-at-a-time summary of every traveler with public
  access, for browsing or feeding into another tool. It does not include each traveler's
  collected field data; use the per-traveler export above for that.

This document covers both.

---

## Export one traveler's data

### Using the UI

1. Open the traveler you want to export (either the editable view at
   `/travelers/:id/` or the read-only view at `/travelers/:id/view`).
2. Click the **Download CSV** button near the top of the page.
3. Your browser downloads a file named `traveler-<id>.csv`.

The button is available to anyone who can open the traveler page, so it follows
the same access rules as viewing the traveler (owner, reviewer, a user or group
it's been shared with, or a traveler with public access).

### Using a direct request

The export is served by the same session-authenticated web application the
browser UI uses — `GET /travelers/:id/csv` — not by the separate basic-auth REST
API. To fetch it outside a browser, reuse the app's session cookie,
for example after logging in through a tool that keeps cookies (like
`curl -c`/`-b`):

```bash
curl -b cookies.txt https://<host>/travelers/<traveler-id>/csv -o export.csv
```

| Response                        | Meaning                                                  |
| -------------------------------- | --------------------------------------------------------- |
| `200`, `Content-Type: text/csv` | The CSV file body (see shape below)                      |
| `403`                           | You're logged in, but don't have access to that traveler |
| `404`                           | No traveler exists with that id                          |

### File contents

```
_id,url,title,status,createdBy,createdOn,updatedBy,updatedOn,archivedOn,owner,tags,totalInput,finishedInput,subsystem,device,activity,machineArea,sector,windchillId
<traveler id>,<link back to the traveler>,<title>,<status>,...

Field Name,Label,Type,Value,Input By,Input On
<field name>,<field label>,<field type>,<value>,<who entered it>,<when, as a Unix timestamp>
...

Id,Original File Name,File Name,Encoding,Mimetype
<data id>,<name uploaded with>,<on-disk name>,<encoding>,<mimetype>
...
```

Three sections, each self-describing with its own header row:

**The traveler section** is a header row and one row of the traveler's own
properties — the same properties as the public travelers list export (see
below), with `url` (a link back to the traveler within the application) added
after `_id`: `_id, url, title, status, createdBy, createdOn, updatedBy,
updatedOn, archivedOn, owner, tags, totalInput, finishedInput, subsystem,
device, activity, machineArea, sector, windchillId`. Some things worth
knowing:

- **`status` is the human-readable name** (`active`, `completed`, and so on),
  never an internal numeric code. An archived traveler always shows `archived`
  here.
- **`archivedOn` is set only while the traveler is currently archived** — the
  date is not left behind once a traveler is restored.
- **`owner` falls back to the creator** when the traveler has no explicit
  owner.
- **`device` falls back to the older `devices` list**, joined with `/`, for a
  traveler that predates the single `device` field — see
  [`form-traveler-metadata.md`](form-traveler-metadata.md).
- **`tags` are joined with semicolons** in one cell.
- **These dates (`createdOn`, `updatedOn`, `archivedOn`) are ISO 8601 UTC
  timestamps**, e.g. `2026-09-14T09:41:03.000Z` — unlike `Input On` in the
  data section below, which is still a Unix timestamp.
- Text that would otherwise be read as a spreadsheet formula (starting with
  `=`, `+`, `-`, or `@`) is shown as plain text.

**The data section** lists every value ever submitted, and is unchanged from
before:

- **Every defined field appears**, even one nobody has filled in yet — its
  Value, Input By, and Input On are left blank.
- **A field answered more than once produces one row per submission**, oldest
  first — nothing is collapsed to "the latest value," so the full history is in
  the file.
- **`Input On` is a Unix timestamp** (whole seconds since 1970-01-01 UTC), not a
  date string. Most spreadsheet tools can convert it: in Excel or Google Sheets,
  `=(<cell>/86400)+DATE(1970,1,1)` formatted as a date/time will render it as a
  normal date.
- **A file/attachment field's Value is the id of that submission** (its
  TravelerData id), not a filename or a link — look it up in the Files section
  below for the file's details, or visit `/data/:id` (while logged in) to
  retrieve the file itself.
- Values containing a comma, quote, or line break are quoted so the file still
  opens correctly in spreadsheet applications.

**The Files section** describes every file ever submitted to a file-type
field, in the same order as the data section above, one row per submission —
so a field re-submitted twice has two rows here too, matching its two data
rows:

- **`Id`** is the same id shown as that submission's Value in the data
  section, letting you match a Files row back to the field it belongs to.
- **`Original File Name`** is the name the file was uploaded with.
- **`File Name`** is its name on disk, which is not the original name — the
  upload process stores each file under a generated name.
- **`Encoding`** and **`Mimetype`** are as recorded at upload time.
- The header row is always present, even for a traveler with no files.
- Like the traveler section, values here are shown as plain text if they
  would otherwise be read as a spreadsheet formula.

### When the export is empty

If a traveler has no data fields defined yet, the file still contains the
traveler section, and the data and Files header rows, just no rows underneath
them.

---

## Export the list of public travelers

### Using the UI

Open **Public accessible travelers** (`/publictravelers/`), reachable from the
travelers page. The dashboard shows:

- **Status cards** across the top — one per status plus an **All** card, each
  showing how many public travelers are in it. Click a card to narrow the
  table to that status; click it again (or click **All**) to clear the choice.
- **A filter bar** — an update-date range, Subsystem, Device, Activity,
  Machine area, Sector, Windchill ID, Tags (comma-separated), and an *Include
  archived* checkbox, with **Apply** and **Clear** buttons.
- **A table** of the matching travelers, newest updated first, with Previous
  and Next controls and a choice of how many rows to show per page.
- **Download CSV**, which downloads every traveler matching the current
  filters as a CSV file — not just the page currently on screen.
- **Generate report** and **Add to binder**, which act on the rows you tick
  in the table, the same as elsewhere in the application.

Only travelers with public access (read or write) ever appear here, whoever
is looking, including the travelers' own owners and admins — this page is
specifically the *public* list, not a general traveler search.

### Using a direct request

Unlike the single-traveler export above, the public travelers list is
available two ways, returning identical data either way:

| | Web application | REST API |
| --- | --- | --- |
| URL | `GET /publictravelers/list` | `GET /apis/publictravelers/` |
| Authentication | Session cookie (same as the dashboard) | HTTP Basic auth, on the separate REST API server |
| Typical use | Driving the dashboard itself | Scripts and other systems |

```bash
# web app, with a session cookie
curl -b cookies.txt "https://<host>/publictravelers/list?status=active&subsystem=cryo"

# REST API, with API credentials
curl -u <api-user>:<api-password> "https://<api-host>/apis/publictravelers/?status=active&subsystem=cryo"
```

#### Query parameters

All optional; a traveler must match every filter given, and a blank value is
treated as not given.

| Parameter | Meaning |
| --- | --- |
| `format` | `json` (default) or `csv` |
| `page`, `limit` | Paging. `page` defaults to 1; `limit` defaults to 25 and is capped at 500 |
| `updatedFrom`, `updatedTo` | Only travelers updated in this range (a date or an ISO 8601 timestamp, either end optional, both inclusive). A traveler nobody has edited is placed by when it was created |
| `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId` | Partial, case-insensitive text match. `device` also matches the older `devices` list for a traveler with no `device` of its own |
| `status` | One or more statuses, by name or code, comma-separated or repeated; a traveler matches if it is in any of them |
| `tags` | One or more tags, comma-separated or repeated; a traveler must have all of them |
| `includeArchived` | `true` to also list archived travelers (left out by default); asking for the `archived` status implies it |

```text
/publictravelers/list?status=active&subsystem=cryo&updatedFrom=2026-09-01&limit=50
/apis/publictravelers/?tags=leak-check,vacuum
/apis/publictravelers/?status=archived&includeArchived=true
```

#### JSON response (the default)

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

Every property is always present; a missing value is an empty string, an
empty list, `0`, or `null` (for a date). `status` is the human-readable name
and `statusCode` its number; an archived traveler always shows `archived`.
`owner` falls back to the creator, and `device` falls back to the older
`devices` list, exactly as in the single-traveler export above.

`total` is how many travelers match every filter including `status`;
`statusCounts` ignores the `status` filter, so it can show every status's
count while one is selected — that is what drives the dashboard's status
cards. A page past the last one comes back empty, with the correct `total`.

#### CSV response (`format=csv`)

The same travelers, in the same order, as a file: a header row, then one row
per traveler, in these columns (the same as the JSON properties, minus
`statusCode`):

`_id, title, status, createdBy, createdOn, updatedBy, updatedOn, archivedOn, owner, tags, totalInput, finishedInput, subsystem, device, activity, machineArea, sector, windchillId`

- **Without `page` or `limit`, the file holds every matching traveler**, not
  just one page — this is what the dashboard's Download CSV button uses.
  Supplying either one limits the file to that page.
- Dates are ISO 8601 UTC; `tags` are joined with semicolons; text that would
  be read as a spreadsheet formula is shown as plain text — the same rules as
  the traveler section of the single-traveler export above.
- When nothing matches, the file has only the header row.

#### Errors

An invalid request (an unknown `status`, a bad date, `page`/`limit` out of
range, and so on) gets a `400` response with a JSON body naming the problem,
whichever `format` was asked for — never a partial file. Missing or invalid
credentials get a `401` (REST) or the usual sign-in redirect (web).
