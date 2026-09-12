# RFC: File Input History

## Summary

In the traveler file input history, render the uploaded files in a table format. Columns are file name (with link to file), uploaded on, uploaded by, and a column of remove action. When the user clicks on the remove button, the uploaded file is removed from file system and traveler history. The latest uploaded file should on the top. A preview of the file pops up when hover on the file. A click on the file triggers a download.

## Motivation

This change will allow the user to easily see all the files uploaded already, and remove those not needed.

## Detailed Design

### Data model

No schema changes are required. Each upload already produces a `TravelerData` document
(`model/traveler.js`) with `inputType: 'file'`, `value` (original filename), `file.path`,
`file.mimetype`, `inputBy`, and `inputOn`. The traveler's `data` array holds the ordered
list of `TravelerData` ids.

### New backend endpoint — delete a file upload

```
DELETE /travelers/:id/data/:dataId
```

- Auth: `ensureAuthenticated`, `canWriteMw`, traveler status `[1]` (active only).
- Loads the `TravelerData` record; verifies it belongs to this traveler (`doc.data`
  contains `dataId`) and has `inputType: 'file'`.
- Calls `fs.unlink` on `data.file.path` (ignores ENOENT — file already gone is fine).
- Pulls `dataId` from `doc.data` and removes the `TravelerData` document.
- Returns `204` on success.

### Frontend — file history table

`generateHistoryRecordHtml` in `public/javascripts/lib/traveler.js` currently renders all
history as an inline string. For `inputType === 'file'` a separate rendering path is
needed.

Add a new exported function `generateFileHistoryTableHtml(records)` that accepts an
array of file history records (newest first) and returns an HTML table:

```html
<table class="table table-condensed file-history-table">
  <thead>
    <tr>
      <th>File</th>
      <th>Uploaded On</th>
      <th>Uploaded By</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <!-- one <tr data-data-id="..."> per record -->
  </tbody>
</table>
```

Each row:

```html
<tr data-data-id="<TravelerData._id>">
  <td>
    <a href="<prefix>/data/<id>" class="file-history-link"
       data-mimetype="<mimetype>">
      <filename>
    </a>
  </td>
  <td><span data-livestamp="<inputOn>"></span></td>
  <td><inputBy></td>
  <td>
    <button class="btn btn-small btn-warning file-history-remove">
      <i class="fa fa-trash-o fa-lg"></i>
    </button>
  </td>
</tr>
```

The link's `href` points to `GET /data/:id`, which already responds with
`Content-Disposition: attachment` for file types, triggering a browser download on click.

#### Replacing the existing inline history for file inputs

In `traveler.js` (and `lib/traveler.js`), wherever history is rendered for a file-type
input, call `generateFileHistoryTableHtml` instead of the inline `generateHistoryRecordHtml`
loop. The existing `.input-history` div is replaced with the table. Newest entry stays at
the top by prepending each new row on upload success.

Because the table always shows all uploads sorted newest-first, the `.file-current` span
that previously highlighted the latest file next to the input element is removed. The top
row of the table serves the same purpose.

#### Preview button

For image files (`image/*`), a dedicated preview button is shown in a separate column of
the file history table. Clicking the button opens a Bootstrap popover showing the image at
160 × 120 px with `object-fit:contain`. The image is fetched from `GET /data/:id/preview`
(inline Content-Disposition) via `data-preview-src` on the button element.

Clicking anywhere outside the popover (document click handler) dismisses it. Clicking a
different preview button dismisses any open popover first.

Use `trigger: 'manual'`, `placement: 'left'`, `html: true`. Non-image files have no
preview button (empty cell).

#### Remove action

Delegate a click handler on `.file-history-remove` buttons (scoped to `#form`):

1. Send `DELETE /travelers/:id/data/<dataId>`.
2. On `204`: remove the `<tr>` from the table; if the table body is now empty, remove the
   entire table (and the `.input-history` container).
3. On error: display an alert in `#message`.

### Table cell file inputs

The same table rendering applies inside `.form-table` cells. The existing
`.table-history-section` / `.cell-history-item` structure wraps the file history table the
same way it wraps other cell history today.

## Drawbacks

- Hover preview fetches the full file from the server on first hover. For large files this
  is slow and wasteful; only the image case actually benefits from the preview content.
- Removing a file is irreversible from the UI. There is no undo or soft-delete.

## Alternatives

- **Inline list instead of table**: simpler to implement, but harder to scan when many
  files are uploaded to one input.
- **Soft-delete (archive flag)**: mark the `TravelerData` record as removed rather than
  deleting it and the file, preserving the audit trail. Adds complexity and leaves files
  on disk.

## Unresolved Questions

- Should the remove action be restricted to the user who uploaded the file, or available
  to anyone with write access to the traveler?
- Should completed/frozen travelers allow file removal, or should it be locked to active
  status only (as proposed)?
- For the preview, should a size threshold suppress the image fetch entirely to avoid
  stalling the UI on large images?
