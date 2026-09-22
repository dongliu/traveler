### The list of public travelers

- Method: GET
- URL: https://hostname:port/apis/publictravelers/
- Sample response:

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
    },
    ...
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

The list holds the travelers that have public access (public read or public
write), a page at a time, with the most recently updated first. A traveler that
nobody has edited yet is ordered by the time it was created. Travelers that are
archived are left out unless they are asked for (see the filters below). The
list is read-only.

Each traveler is a JSON object with its id (`_id`), title, status, createdBy,
createdOn, updatedBy, updatedOn, archivedOn, owner, tags, totalInput,
finishedInput, subsystem, device, activity, machineArea, sector, and
windchillId. Every property is always present; a property with no value is an
empty string, an empty list, `0`, or `null` (for a date). `status` is the name
of the status (`initialized`, `active`, `submitted for completion`, `completed`,
`frozen`, or `archived`) and `statusCode` its number (`0`, `1`, `1.5`, `2`, `3`,
or `4`). `owner` is the creator when a traveler has no explicit owner.
`archivedOn` is set only while a traveler is archived. `device` is the
traveler's device; a traveler from before that property, which only has the
older list of devices, has those names joined with `/`. Timestamps are ISO 8601
UTC. The traveler id can be used to retrieve more details of a traveler,
https://hostname:port/apis/travelers/:id/ for the JSON representation and
http://hostname:port/travelers/:id/ for the HTML representation.

The list is paged with two optional query parameters.

- `page`: the page to return, a whole number from 1 to 100000. The default is 1.
- `limit`: the number of travelers per page, a whole number of 1 or more. The
  default is 25 and the largest is 500; a larger value is reduced to 500.

```text
https://hostname:port/apis/publictravelers/?page=2&limit=50
```

The list can be narrowed with filters. All of them are optional, any combination
can be used, and a traveler must match every filter that is given. A filter with
a blank value is ignored.

- `updatedFrom` and `updatedTo`: only travelers updated within a range. Each is
  a date (`2026-09-01`) or an ISO 8601 timestamp (`2026-09-01T10:30:00Z`), and
  either can be used alone. Both ends are included. A date stands for the whole
  of that day in the server's time zone, so `updatedTo=2026-09-15` includes
  everything on 15 September. A traveler that nobody has edited is placed by the
  time it was created. `updatedFrom` must not be after `updatedTo`.
- `subsystem`, `device`, `activity`, `machineArea`, `sector`, and `windchillId`:
  travelers whose value contains the given text, ignoring letter case.
  `subsystem=cryo` finds `Cryogenics` and `CRYO-2`. The text is taken literally,
  so characters such as `(`, `*`, and `.` have no special meaning. `device` also
  finds a traveler through its older list of devices, when it has no device of
  its own. At most 200 characters, and no null character (`%00`).
- `status`: travelers in a status, given by name (`initialized`, `active`,
  `submitted for completion`, `completed`, `frozen`, or `archived`, in any
  letter case) or by code (`0`, `1`, `1.5`, `2`, `3`, or `4`). Several statuses
  can be given, separated by commas or by repeating the parameter, and a
  traveler matches if it is in any of them.
- `tags`: travelers that have all of the given tags, separated by commas or by
  repeating the parameter. A tag has to match a whole tag, ignoring letter case.
- `includeArchived`: `true` also lists archived travelers, which are left out
  otherwise. Asking for the `archived` status includes them too. An archived
  traveler always has the status `archived`, whatever status it had before, and
  its `archivedOn` is set.

```text
https://hostname:port/apis/publictravelers/?status=active&subsystem=cryo&updatedFrom=2026-09-01&limit=50
https://hostname:port/apis/publictravelers/?tags=leak-check,vacuum
https://hostname:port/apis/publictravelers/?status=archived
```

The response also states the page and the `limit` that was applied, `total` (the
number of travelers that match every filter, including `status`), and
`statusCounts` (how many travelers are in each status for all the other filters,
so the status filter does not change it). A traveler with no recorded status is
counted as `initialized`. The `archived` count is present only when archived
travelers are included. A page beyond the last one returns an empty list with
the correct total.

#### CSV output

Add `format=csv` to get the same list, with the same filters and in the same
order, as a CSV file for a spreadsheet application. The default is
`format=json`.

```text
https://hostname:port/apis/publictravelers/?format=csv&status=active&subsystem=cryo
```

The response is a download (`Content-Type: text/csv; charset=utf-8` and a
`Content-Disposition` header that names the file
`public-travelers-YYYYMMDD.csv`, with the date of the request in UTC). The file
has a header row and then one row per traveler, in this order of columns:

`_id, title, status, createdBy, createdOn, updatedBy, updatedOn, archivedOn, owner, tags, totalInput, finishedInput, subsystem, device, activity, machineArea, sector, windchillId`

- Without `page` and `limit`, the file holds every traveler that matches, not
  one page. With either of them, it holds just that page, as in the JSON output.
  `limit` still has an upper bound of 500 in that case.
- A property with no value is an empty cell. `tags` are joined with semicolons
  in one cell (`leak-check;vacuum`). Timestamps are ISO 8601 UTC. `status` is
  the name of the status; the number (`statusCode`) is only in the JSON output.
- Commas, double quotes, and line breaks in a value are escaped as RFC 4180
  asks, so a value stays in one cell, and international characters are kept (the
  file is UTF-8).
- Text that would make a spreadsheet application run a formula, that is text
  starting with `=`, `+`, `-`, or `@`, is given a leading single quote so that
  it shows as text.
- When nothing matches, the file has only the header row.
- An invalid request still gets a JSON error, not a file.

An invalid request gets a 400 response with a JSON body naming the problem, for
example `{"error": "page must be an integer between 1 and 100000"}`. A request
without valid credentials gets a 401 response.
