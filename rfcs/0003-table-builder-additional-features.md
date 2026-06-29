# RFC: Table Builder Additional Feature (6/1/2026)

## Summary

The first set of features of table builder was implemented as described in rfcs/0001-table-builder.md. Two features need to be added which were not in the original design.

## Motivation

The changes will allow the user to 1) reset and modify a cell's type after it is initially selected from the dropdown; and 2) add instruction to any cell in the table.

## Detailed Design

- All cells (including those in the first row and first column) support any cell type via the type dropdown. The `header`, `empty`, `text`, `checkbox`, `radio`, `file`, and `instruction` types are available for every cell.
- Row and column control buttons (move, delete) are rendered directly inside the table during editing rather than in a separate spec panel list:
  - A control row is prepended to the table with ←/→/✕ buttons for each column.
  - A control cell is prepended to each data row with ↑/↓/✕ buttons.
  - Control elements are marked `.table-edit-ui` and removed on Done.
- A new `instruction` cell type uses a TinyMCE editor (initialized inline in the cell-edit modal) to add rich text to any cell. Content is stored as `<div class="table-cell-instruction">` with `data-cell-type="instruction"`.

### UI / Form Builder Integration

**`public/javascripts/lib/table-builder.js`**

- `buildInTableControls($table)` — replaces the spec-panel row/column manage lists. Injects a `.table-control-row` at the top of tbody and a `.table-row-ctrl` cell at the start of each data row, each with the appropriate move/remove buttons.
- `getDataRows` filters out `.table-control-row`; column operations use `.not('.table-row-ctrl')` to address only data cells.
- `openCellEditModal` — unified for all cells (no separate `isHeader` path). Dropdown starts at the cell's current `data-cell-type` (defaulting to `header` for `<th>`, `empty` for `<td>`). Completing with `header` type swaps a `<td>` to `<th>` and vice versa.
- `renderCellConfig` / `applyCellType` — extended with `header` and `instruction` cases. The `instruction` case initializes a lightweight TinyMCE instance on a textarea inside the modal and destroys it on type-switch, Complete, or modal dismiss.
- Spec panel simplified to label input + Done button only.

**`public/stylesheets/style.css`**

- Control row/cells (`.table-col-ctrl`, `.table-row-ctrl`, `.table-ctrl-corner`) override the editing-mode pointer cursor and hover highlight with a neutral grey background.
- `.table-cell-instruction` — minimal padding for rendered instruction content in traveler view.

### Data Model

No change.

### API Changes

No change.

### Rendering in Traveler View

No change.

## Drawbacks

TBD

## Alternatives

TBD

## Unresolved Questions

TBD
