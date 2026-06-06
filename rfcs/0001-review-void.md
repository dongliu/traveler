# RFC 0001: Void previous approval review results on a rejection

## Summary

When a reviewer submits a review result of rejection in the form review process, previously submitted approval review results should be marked as voided.

## Motivation

Previously submitted approvals should be voided on record, since the rejection signals that re-review is required.

## Requirements

- The review model should have a void status in `reviewResult`.
- Previously submitted approval review results will be voided once a rejection is in place.
  - A voided result is terminal — it cannot transition to any other status.
- The review history on the form page should not display voided review results.
- Traveler review process is out of scope, because there can be only one reviewer.

## Design

## Implementation

## Alternatives Considered

TBD

## Open Questions

TBD
