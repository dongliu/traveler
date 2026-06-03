# RFC: Traveler File Input

## Summary

For an input if file type in traveler, the current implementation add the upload file link in the history section. The UI should be more user-intuitive to show a file has already uploaded.

## Motivation

Provide a better and more intuitive experience for file input and its history, especially for the file input in a table cell.

## Detailed Design

After the user upload a file for a file input, the file linked to its location on service should be append to the file input button. Only the latest uploaded file should be shown. The input history behavior should not change.

### UI / Traveler Changes

**`public/javascripts/traveler.js`**

- `button[value="upload"]` done handler (non-table file inputs): after updating `.input-history`, removes any existing `.file-current` sibling of the file input and inserts a new `<span class="file-current">` immediately after the `<input type="file">`, containing a link to the just-uploaded file using the URL returned by the server (`json.location`).
- `button[value="table-cell-upload"]` done handler (table cell file inputs): same — inserts/replaces `.file-current` inside the `<td>` after the file input before clearing the cell editing state.

**`public/javascripts/lib/traveler.js`**

- `renderHistory()` non-table file path: before appending `.input-history`, inserts a `.file-current` span after the file input using `${prefix}/data/${latest._id}` with a `download` attribute and the stored filename as link text. Only the most recent record (`found[0]`, sorted by `inputOn` descending) is used.
- `renderHistory()` table cell file path: for `element.type === 'file'`, inserts the same `.file-current` span inside the cell, then returns early (file inputs cannot be pre-populated, so value restore is skipped).

**`public/stylesheets/style.css`**

- `.file-current` — small left margin (`6px`) and slightly reduced font size (`13px`) so the link sits neatly beside the file button without dominating it.

### Data Model

No change.

### API Changes

No change.

## Drawbacks

Not known.

## Alternatives

Not known.

## Unresolved Questions

Not known.
