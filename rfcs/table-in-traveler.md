## Summary

After the table builder feature in `rfcs/table-builder.md` is implemented, the traveler user can update the inputs in a table.

## Status

Implemented.

## Motivation

The user interaction with inputs inside a table is different from those not in a table that were already implemented in `public/javascripts/traveler.js`. Table cells are not wrapped in `.controls`, so the existing input-handling pipeline cannot be used directly.

## Constraints

Reuse existing traveler UI logic and server-side controller as much as possible. No new API endpoints or data model changes are needed — cell inputs follow the same `./data/` POST convention as all other traveler inputs.

## Detailed Design

Because a table can contain many rows/columns, the new experience follows these principles:

- Clearly show which cell is in edit mode, consistent with non-table inputs.
- The user explicitly saves or resets after touching a cell input.
- Update history is saved in the database but is not shown inline in a cell.
- A collapsed section is appended under the table showing all updates grouped by cell.

### Data model

No new data model is needed. Each cell input stores its value in the existing `traveler.data` array keyed by the input's `name` attribute, identical to all other traveler inputs.

### UI / traveler changes

**`public/javascripts/traveler.js`**

- `formInputMade()` — added early return when the touched input is inside `.form-table`, preventing the non-table handler from trying to find `.controls` and incorrectly disabling all inputs.
- `tableInputMade()` — new function called when any cell input is touched:
  - Adds class `table-cell-editing` to the `<td>` to highlight the active cell.
  - Disables all other form inputs (consistent with non-table behavior).
  - Disables the `#complete` button.
  - Appends Save / Reset buttons (`.table-cell-buttons`) inside the `<td>` below the input.
- Delegated `click` handler on `#form` for `.form-table td input[type="radio"]` and `input[type="checkbox"]` → `tableInputMade`.
- Delegated `input` handler on `#form` for `.form-table td` text/textarea inputs → `tableInputMade`.
- `button[value="table-cell-save"]` handler:
  - Determines the checked radio if the cell type is radio.
  - Records whether this is the first save for the cell (used to call `incrementFinished()`).
  - POSTs `{ name, type, value }` to `./data/` — the same endpoint used by all other inputs.
  - On success: prepends a new history record to the cell's entry in the history section, or creates the section/entry if it does not yet exist. Expands the section so the new record is visible. Calls `incrementFinished()` on the first save per cell. Removes the cell highlight and buttons.
  - On failure: shows an error alert. Re-enables all inputs in `.always()`.
- `button[value="table-cell-reset"]` handler:
  - Restores each cell input from the binder (or clears it if never saved).
  - Re-enables all form inputs and removes the cell highlight and buttons.

**`public/javascripts/lib/traveler.js`**

- `renderTableHistorySections(data)` — new exported function:
  - Iterates over every `.table-group` in `#form`.
  - For each cell `<td>` that has at least one history record in `data`, determines the row and column labels from the corresponding `<th>` elements.
  - Builds a collapsed Bootstrap accordion (`<div class="collapse">`) appended inside `.table-group`, containing one `.cell-history-item` per cell, labelled `Row × Col`.
  - Only creates the section when at least one cell has history; tables with no prior data get no section.
- `renderHistory()` — extended:
  - After the existing `.controls` loop, iterates over `.form-table tbody td` to restore saved values into cell inputs via `binder.deserializeFieldFromValue` — identical logic to the non-table path.
  - Calls `renderTableHistorySections(data)` to build the history sections before enabling the form.

**`public/stylesheets/style.css`**

- `.form-table td.table-cell-editing` — green background (`#dff0d8`) on the cell currently being edited.
- `.table-cell-buttons` — top margin separating the Save/Reset buttons from the input above.
- `.table-history-section`, `.table-history-toggle`, `.table-history-content` — layout for the collapsed history accordion appended under the table.
- `.cell-history-item` — bottom border separator between per-cell history rows; removed on the last item.

## Drawbacks

- The input history for a table could be massive if the table is large and frequently updated.
- The history section is rebuilt from the full `./data/` response on every page load; for travelers with many table updates this adds to the rendering work done in the browser.

## Alternatives

- Showing history inline in each cell was rejected per the design principle: cells should stay compact and the history should be available on demand via the collapsed section.
- A separate API endpoint for table-cell data was not added because the existing `./data/` POST already handles arbitrary named inputs.

## Unresolved Questions

- Should the history section support filtering or pagination when a single cell has many updates?
- Should table cell notes (the same per-input note feature that non-table inputs have) be supported in a future iteration?
