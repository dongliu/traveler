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

### Schema — `reviewResult` sub-document (`model/review.js`)

Add an optional `voided` field to the `reviewResult` sub-document:

```js
voided: { type: Boolean }
```

Absent / `undefined` means the result is active. `true` means it has been voided. The field is intentionally sparse so that existing records require no migration.

### Voiding logic — `addReviewResult()` (`model/review.js`)

When a reviewer submits `result === "2"` (rejection), before pushing the new result, iterate `__review.reviewResults` and set `voided = true` on every entry that:
- has `result === "1"` (approval), **and**
- has the same `v` (document version) as the incoming rejection, **and**
- is not already voided.

This keeps the operation scoped to the active review cycle and is safe to re-apply (idempotent per the terminal-state requirement).

### Approval check — `allApproved()` (`model/review.js`)

The existing method builds a per-reviewer map of latest results filtered by version. Extend the filter to also exclude entries where `voided === true`. This ensures a voided approval is never counted toward the approval threshold, even if version filtering alone would have caught it.

### View — review history (`views/form-builder.jade`, `views/released-form.jade`)

When rendering `review.reviewResults`, skip entries where `result.voided === true`. No visual indicator (e.g. strike-through) is shown; voided results are fully omitted from the list.

> **Clarification needed**: The requirement says voided results should not be displayed. This design interprets that as completely hidden. If an audit trail is needed on-screen (e.g. showing voided approvals in a muted style), the view logic would change but the model design stays the same.

## Implementation

TBD

## Alternatives Considered

TBD

## Open Questions

- **Does the document version (`v`) increment when an owner resubmits after a rejection?** If yes, version filtering in `allApproved()` already isolates each review cycle, and the `voided` flag is only needed for the display requirement. If no, the `voided` flag becomes load-bearing for correctness in `allApproved()` as well.
