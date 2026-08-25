# Export traveler data to CSV

Any traveler's data can be exported as a CSV file: the traveler's link, id,
title, and status, followed by every value ever submitted for each of its data
fields.

## Using the UI

1. Open the traveler you want to export (either the editable view at
   `/travelers/:id/` or the read-only view at `/travelers/:id/view`).
2. Click the **Download CSV** button near the top of the page.
3. Your browser downloads a file named `traveler-<id>.csv`.

The button is available to anyone who can open the traveler page, so it follows
the same access rules as viewing the traveler (owner, reviewer, a user or group
it's been shared with, or a traveler with public access).

## Using a direct request

The export is served by the same session-authenticated web application the
browser UI uses — `GET /travelers/:id/csv` — not by the separate basic-auth REST
API (`/api/...`). To fetch it outside a browser, reuse the app's session cookie,
for example after logging in through a tool that keeps cookies (like
`curl -c`/`-b`):

```bash
curl -b cookies.txt https://<host>/travelers/<traveler-id>/csv -o export.csv
```

| Response                        | Meaning                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `200`, `Content-Type: text/csv` | The CSV file body (see shape below)                      |
| `403`                           | You're logged in, but don't have access to that traveler |
| `404`                           | No traveler exists with that id                          |

## File contents

```
Traveler Link,<link back to the traveler>
Traveler Id,<traveler id>
Traveler Title,<traveler title>
Traveler Status,<human-readable status, e.g. "active">

Field Name,Label,Type,Value,Input By,Input On
<field name>,<field label>,<field type>,<value>,<who entered it>,<when, as a Unix timestamp>
...
```

A few things worth knowing about the data rows:

- **Every defined field appears**, even one nobody has filled in yet — its
  Value, Input By, and Input On are left blank.
- **A field answered more than once produces one row per submission**, oldest
  first — nothing is collapsed to "the latest value," so the full history is in
  the file.
- **`Input On` is a Unix timestamp** (whole seconds since 1970-01-01 UTC), not a
  date string. Most spreadsheet tools can convert it: in Excel or Google Sheets,
  `=(<cell>/86400)+DATE(1970,1,1)` formatted as a date/time will render it as a
  normal date.
- **A file/attachment field's Value is a download link** (pointing at
  `/data/:id`), not the filename — click it (while logged in) to retrieve the
  actual file.
- Values containing a comma, quote, or line break are quoted so the file still
  opens correctly in spreadsheet applications.

## When the export is empty

If a traveler has no data fields defined yet, the file still contains the
metadata block and the column header row, just no data rows underneath.
