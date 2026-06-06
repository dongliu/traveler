# RFC 0001: Void previous approval review results on a rejection

## Summary

When a reviewer submits a review result of rejection in the form review process, previously submitted approval review results should be marked as voided.

## Motivation

Previously submitted approvals should be voided on record, since the rejection signals that re-review is required.

## Requirements

- The review model should have a void status in `reviewResult`.
- Previously submitted approval review results will be voided once a rejection is in place.
  - A voided result is terminal — it cannot transition to any other status.
- The review history on the form page displays voided review results in a separate collapsed section, showing the submitted date and the voided date for each entry.
- The document version (`_v`) is not incremented when a rejection is submitted.
- Traveler review process is out of scope, because there can be only one reviewer.

## Design

### Schema — `reviewResult` sub-document (`model/review.js`)

Add two optional fields to the `reviewResult` sub-document:

```js
voided:   { type: Boolean },
voidedOn: { type: Date }
```

Absent / `undefined` means the result is active. Both fields are intentionally sparse so that existing records require no migration.

### Voiding logic — `addReviewResult()` (`model/review.js`)

When a reviewer submits `result === "2"` (rejection), before pushing the new result, iterate `__review.reviewResults` and set `voided = true` and `voidedOn = <current timestamp>` on every entry that:
- has `result === "1"` (approval), **and**
- has the same `v` (document version) as the incoming rejection, **and**
- is not already voided.

This keeps the operation scoped to the active review cycle and is safe to re-apply (idempotent per the terminal-state requirement).

The document version (`_v`) is **not** incremented on rejection. Since `_v` stays the same across the re-review cycle, the `voided` flag is the authoritative signal for excluding prior approvals in `allApproved()`.

### Approval check — `allApproved()` (`model/review.js`)

The existing method builds a per-reviewer map of latest results filtered by version. Extend the filter to also exclude entries where `voided === true`. This ensures a voided approval is never counted toward the approval threshold, even if version filtering alone would have caught it.

### View — review history (`views/form-builder.jade`, `views/released-form.jade`)

Split the rendered review results into two groups:

- **Active results** — entries where `voided` is absent or `false`. Rendered as today, unchanged.
- **Voided results** — entries where `voided === true`. Rendered in a separate section below the active results, collapsed by default. Each row shows the reviewer name, the original submitted date (`submittedOn`), and the voided date (`voidedOn`).

## Implementation

TBD

## Alternatives Considered

TBD

## Open Questions

TBD
