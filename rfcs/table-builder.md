## Summary

Add a new feature in the form-builder that enables the user to add a table of inputs in the form.

## Motivation

With this feature, the user can define a table in the form so that data can be collected when users to finish the travelers created from the form.

## Detailed Design

### Data model

The use-defined table will be inside the html saved on the form model.

### UI / form-builder changes (`public/javascripts/form-builder.js` and `views/form-builder.jade`)

- Add a **Table** button to the input-type palette alongside existing input types.
- A new 2X2 table is added when use chooses the table type.
  - A new row can be added when clicking on a button at the bottom of the table.
  - A new column can be added when clicking on a button at the right side of the table.
  - A row or a column can be removed.
  - A row or a column can be moved if it is not the first.
- The user then can click on a cell to define the contents inside the cell.
  - The cells in first row and first column only allow text display in bold.
  - Other cells can be a checkbox, a radio, or a text input, or leave empty.
- A modal will show when a cell is edited.
  - Leverage the existing checkbox, radio, or text input in form-builder.js for UI view and control.
  - A click on the complete button inside the model will close the modal with changes.
  - A click on the cancel button inside the model will close the model without changes.
- The individual cell inside the table should not be numbered, and the table should have the number format of number.number .
- The Done button finish the edit of the whole table.
- When the user hovers over the table and click on the edit button, the edit UI appears.
  - The existing table should stay the same, and edit on the basis of it rather than start from scratch.


## Drawbacks

- Increases form-builder complexity and surface area for bugs.

## Alternatives

- not considered

## Unresolved Questions

- How should table data appear in the PDF export when the size is big?
