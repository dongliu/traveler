# RFC: Traveler File Input

## Summary

For an input if file type in traveler, the current implementation add the upload file link in the history section. The UI should be more user-intuitive to show a file has already uploaded.

## Motivation

Provide a better and more intuitive experience for file input and its history, especially for the file input in a table cell.

## Detailed Design

After the user upload a file for a file input, the file linked to its location on service should be append to the file input button. Only the latest uploaded file should be shown. The input history behavior should not change.

### UI / Traveler Changes

To be added.

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
