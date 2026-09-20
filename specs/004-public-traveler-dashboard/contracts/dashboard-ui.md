# Contract: Public Travelers Dashboard (UI)

The page at `GET /publictravelers/` (unchanged address). It calls **only**
`GET /publictravelers/list` ([contract](public-travelers-list.md)) for data (FR-025). Layout follows
the NCR dashboard on the `upton` branch (`views/ncr-dashboard.jade`) with this application's
Bootstrap 2 styling, status names, and column set. Exact pixel design is left to implementation.

## Regions, top to bottom

1. **Toolbar**: Select all, Select none, Generate report, Add to binder, Download CSV.
2. **Message area** (`#message`): where the shared `ajax401` helper writes errors.
3. **Status cards**: "All" plus one card per status, each with a count.
4. **Filter bar**: the filters below, with Apply and Clear.
5. **Table**: the current page of travelers.
6. **Footer row**: range indicator, page-size choice, Previous and Next.
7. **Modal** (`#modal`): reused by the binder and "nothing selected" dialogs, as today.

## Filter bar

| Control | Query parameter sent |
|---|---|
| Updated from (date) | `updatedFrom` |
| Updated to (date) | `updatedTo` |
| Subsystem, Device, Activity, Machine area, Sector, Windchill ID (text) | `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId` |
| Tags (text, comma-separated) | `tags` |
| Include archived (checkbox) | `includeArchived` |
| *(selected status card)* | `status` |

Apply reloads from page 1. Clear empties every filter, unselects the status card, returns to page
1, and reloads.

## Status cards

- Cards: **All**, initialized, active, submitted for completion, completed, frozen, and
  **archived**. The archived card is shown only while "Include archived" is checked.
- Counts come from `statusCounts`; **All** is the sum of the counts shown. They reflect the other
  filters but not the selected status, so switching between cards is always possible.
- Selecting a card sets `status`, returns to page 1, highlights the card; selecting **All** or the
  same card again clears it. Each status has a distinct color, reused by the row status badge.
- The table rows and the counts arrive in the same response, so both update together on every
  load. Selecting a status changes the rows and `total` but not the counts.

## Table

Columns, in order: select checkbox · title (link to `/travelers/<_id>/`) · status badge ·
progress (`finishedInput` of `totalInput`, as a bar with a `finished/total` label; "—" when
`totalInput` is 0) · subsystem · device · activity · machine area · sector · Windchill ID · tags ·
owner · created by / on · updated by / on · archived on (shown only while archived travelers are
included).

- No column sorting: order is always most recently updated first.
- A blank `updatedOn` displays "—".
- Every record value is HTML-escaped before display.
- Rows come from the `travelers` array of the latest response only; a response that arrives after
  a newer request was issued is discarded.
- A DataTable instance is kept purely as a row container (paging, search, and sort off), so the
  shared selection helpers and the binder modal keep working.

## Paging

- **Range indicator**: `start–end of total` (for example `26–50 of 132`); `0 travelers` when empty.
- **Page size**: choice of 10, 25 (default), 50, 100. Changing it returns to page 1.
- **Previous / Next**: disabled on the first and last page. Changing any filter resets to page 1.
- Row selection is per page; changing page clears it (as on the NCR dashboard).

## Actions

| Action | Behavior |
|---|---|
| Select all / Select none | Act on the rows in the current view, exactly as today. |
| Generate report | Posts the selected rows' `_id`s to `/travelers/report/` (unchanged form). With nothing selected, shows the existing "no traveler has been selected" alert. |
| Add to binder | Opens the existing binder modal for the selected rows (`AddBinder.addModal`). |
| Download CSV | Navigates to `/publictravelers/list?format=csv` plus the current filters and status, with **no** `page` or `limit`, so the file holds every matching traveler. |

## States

| State | Display |
|---|---|
| Loading | A "loading" row or indicator in the table area; controls stay usable. |
| Empty | "No public travelers match the current filters." |
| Load failure | An error message in `#message` explaining the load failed, plus a visible Retry control; the previous table is not silently blanked. |
| Validation error (400) | The server's `error` text is shown; the table keeps its previous rows. |

## Preserved from today's page

Address, the traveler link target (`viewConfig.linkTarget`), the binder and report flows, and the
`#modal` markup. Removed: per-column sorting and the column filters, the "shared with" and
"shared group" columns, the reporting-ID (keys) column, and the "filled by" column (recorded in the
spec's Assumptions).
