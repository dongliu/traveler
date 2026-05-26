## Summary

Add a new feature in the form-builder that enables the user to add a table of inputs in the form.

## Status

Implemented.

## Motivation

With this feature, the user can define a table in the form so that data can be collected when users finish the travelers created from the form. Tables allow structured, grid-style data capture that cannot be expressed by a flat list of individual inputs.

## Detailed Design

### Data model

The user-defined table is stored as HTML inside the `html` field of the `Form` model. No separate schema changes are required. Cell type and structure are preserved via HTML attributes (`data-cell-type`) and standard table markup.

### HTML structure

```html
<div class="control-group-wrap">
  <span class="fe-type">table</span>
  <div class="control-group table-group">
    <span class="table-group-number">1.1</span>&nbsp;
    <span class="table-group-label">Table Title</span>
    <table class="form-table table table-bordered">
      <tbody>
        <tr>
          <th data-cell-type="header"><strong></strong></th>
          <th data-cell-type="header"><strong>Column 1</strong></th>
        </tr>
        <tr>
          <th data-cell-type="header"><strong>Row 1</strong></th>
          <td data-cell-type="empty"></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

Cell types are stored in the `data-cell-type` attribute: `header`, `empty`, `text`, `checkbox`, `radio`.

### Numbering

Tables use a two-level numbering format (`section.instruction`, e.g. `1.2`), consistent with rich-instruction blocks. Individual cells are not numbered.

### UI / form-builder changes

**`views/form-builder.jade`**

- Add a **Table** entry to the "Basic inputs" dropdown in the button palette.

**`public/javascripts/form-builder.js`**

- Import `table_edit` and `binding_table_events` from `lib/table-builder.js`.
- Call `binding_table_events()` during page initialization.
- Handle `#add-table` click to call `table_edit(null)` (new table).
- In the hover-edit dispatch, add `case 'table': table_edit($cgr)`.
- In `cleanBeforeSave()`, remove any leftover `.table-edit-ui` elements.
- In the toggle-close path, remove `.table-edit-ui` before clearing `data-status`.
- When duplicating a table, assign a new unique `name` to every cell input individually.
- In `updateSectionNumbers()` and `addSectionNumbers()`, handle `.table-group` at the two-level format (same as `.rich-instruction`).

**`public/javascripts/lib/table-builder.js`** (new file)

- `table_edit($cgr)` — opens the table editor:
  - When `$cgr` is `null`, creates a new 2×2 table and appends it to `#output`.
  - When `$cgr` is provided, edits the existing table **in place** (no cloning, no DOM replacement) so that all rows and columns added by the user are preserved.
  - Appends **+ Add Row** and **+ Add Column** buttons (`.table-edit-ui`) inside the table group.
  - Opens a `.well.spec` panel with: a table label field, a row management list, a column management list, and a **Done** button.
  - The row and column management lists show move-up / move-down / remove controls for every non-first row or column.
  - Clicking **Done** assigns unique `name` attributes to all unnamed cell inputs, removes `.table-edit-ui` elements, removes the spec panel, and calls `updateSectionNumbers()`.
- `binding_table_events()` — attaches a delegated click handler on `#output` that opens a cell-edit modal when a `<th>` or `<td>` is clicked inside a table whose wrapping `.control-group-wrap` has `data-status="editing"`.
- Cell edit modal behavior:
  - Header cells (`<th>`): text-only input, displayed in bold.
  - Data cells (`<td>`): a type selector (`empty`, `text`, `checkbox`, `radio`) followed by type-specific configuration fields. Existing cell content is read back into the modal so edits are non-destructive.
  - **Complete** applies changes; **Cancel** closes without changes.

**`public/javascripts/lib/form-builder-shared.js`**

- `updateSectionNumbers()` — extended to recognize `.table-group` elements and format their `.table-group-number` span at the two-level format.
- `add_new_cgr()` — extended to exclude `feType === 'table'` from the single-name copy logic (tables contain multiple named inputs).

**`public/stylesheets/style.css`**

- `.table-group`, `.table-group-number`, `.table-group-label` — layout and typography for the table wrapper.
- `.control-group-wrap[data-status="editing"] .form-table th/td` — `cursor: pointer` and hover highlight to indicate cells are clickable in edit mode.
- `.table-action-btns`, `.table-manage-list`, `.table-manage-item`, `.table-item-label` — layout for the editing controls.

**`lib/req-utils.js`**

- `allowedAttributes` — added `table`, `thead`, `tbody`, `tr`, `th`, `td` entries to allow `class`, `style`, `data-cell-type`, `colspan`, `rowspan`, and `scope` through HTML sanitization.

## Drawbacks

- Increases form-builder complexity and surface area for bugs.
- Table HTML is stored inline in the form's `html` field; large tables with many inputs will increase document size.

## Alternatives

- A dedicated sub-document schema for tables was not pursued because all other input types are already stored as HTML, and a schema change would require a migration.

## Unresolved Questions

- How should table data appear in the PDF export when the table is large?
- Should tables support merged cells (colspan / rowspan) in a future iteration?
