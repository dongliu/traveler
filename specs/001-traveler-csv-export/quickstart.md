# Quickstart: Validate Traveler CSV Export

## Prerequisites

- Local MongoDB running and `../etc/traveler-config/` populated (per repo root `README.md` /
  `installation-*.md`), or the Docker dev setup (`docker.md`).
- At least one traveler in the database with a few data fields filled in and at least one field
  left unanswered, so the empty-value row (FR-006) can be observed.
- A user session that has read access to that traveler (owner, reviewer, sharedWith,
  sharedGroup, or publicAccess — see `data-model.md`), and a second user/session that does not.

## Run the app

```bash
npx nodemon
# or: node app.js
```

## Automated checks

```bash
npx eslint .
npx mocha test/lib/csv-test.js
npx mocha test/lib/          # full lib suite, ensure no regressions
```

Expected: lint clean, `csv-test.js` passes covering plain values, comma-containing values,
quote-containing values, embedded newlines, and empty values.

## Manual validation scenarios

Each maps to an Acceptance Scenario in `spec.md`.

1. **Happy path (US1, Scenario 1)** — As a user with access, visit
   `http://localhost:<port>/travelers/<id>/csv` in a browser (or `curl -b <session-cookie>
   http://localhost:<port>/travelers/<id>/csv -o export.csv`). Open the file: confirm the
   metadata block (link/id/title/status) appears before the data rows, and each filled-in field
   shows its internal field name, label, type, value, input-by, and input-on.

2. **Unanswered field (US1, Scenario 2)** — Pick a traveler with at least one field never filled
   in. Confirm that field still has a row, with value/input-by/input-on blank.

3. **No access (US1, Scenario 3)** — Using a session/user without read access to the traveler,
   request the same URL. Confirm a `403` and that no CSV content is returned.

4. **Not found (Edge Case)** — Request `/travelers/000000000000000000000000/csv` (a well-formed
   but non-existent id). Confirm a `404` and no file is produced.

5. **Self-describing file (US2)** — Hand the downloaded CSV to someone unfamiliar with the
   traveler; confirm they can state its link, id, title, and status from the file alone.

6. **Human-readable status/labels (US3)** — Export travelers in a few different lifecycle
   statuses (e.g. in-progress and completed); confirm the Status cell always shows the
   human-readable name (per `statusMap`), never a numeric code, and that each Label cell matches
   what's shown for that field in the traveler's own UI.

7. **Special characters (Edge Case / SC-005)** — Enter a value containing a comma, a double
   quote, and a line break into a text field, export, and open the file in a spreadsheet
   application (e.g. Excel, Google Sheets, LibreOffice Calc). Confirm the value lands in a single
   cell, unbroken.

## Expected outcome

All 7 scenarios pass without needing to inspect server logs or the database directly — the CSV
file and HTTP status codes are sufficient evidence per spec.md's Success Criteria.
