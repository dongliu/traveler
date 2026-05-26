## Summary

After the table builder feature in `rfcs/table-builder.md` is implemented, the traveler user can update the inputs in a table.

## Status

Draft.

## Motivation

The user interaction with inputs inside a table is different from those not in a table that were already implemented in `public/javascripts/traveler.js`.

## Constraints

reuse existing traveler UI logic and server side controller as much as possible.

## Detailed Design

Because a table can contain many rows/columns, the new experience should follow the following principles.
- clearly show which cell is in edit mode, which is consistent with those not in table.
- the user indicates save or reset after an input in a table cell is touched.
- the update history is saved in database, but the history is not shown in a cell.
- add a collapsed section under the table showing all the updates grouped by cells.

### Data model

No new data model is needed.

### UI / traveler changes

The change should be in `public/javascripts/traveler.js` and `./lib/traveler.js`.

## Drawbacks

- The input history for a table could be massive.

## Alternatives

Not considered.

## Unresolved Questions
