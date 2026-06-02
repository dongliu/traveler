# RFC: Table Builder Additional Feature (6/1/2026)

## Summary

The first set of features of table builder was implemented as described in rfcs/table-builder.md. Two features need to be added which were not in the original design.

## Motivation

The changes will allow the user to 1) reset and modify a cell's type after it is initially selected from the dropdown; and 2) add instruction to any cell in the table.

## Detailed Design

- The user can specify the type of cell anywhere, including those in first row and first column
  - move the control buttons, move and delete of a row to the very left of the row, similarly those of a column to the very top of the column. No need to identify a row or a column by the text with the th cell.
- When click in a cell that an input was previously specified, the use can choose to `reset` the cell.
  - when reset is clicked, the init type selection dropdown is available.
- Add a new option if input of rich instruction of tinyMCE, with which the user can add a rich text to any cell.


### UI / Form Builder Integration

TBD

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
