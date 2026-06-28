# RFC 0001: Void previous review results on a rejection

## Summary

When a reviewer submits a review result of rejection in the form review process, previously submitted review results — both approvals and rejections — should be marked as voided.

## Motivation

Previously submitted results (approvals and rejections alike) should be voided on record, since the rejection signals that re-review is required. Voiding prior rejections as well keeps the active result set clean and avoids ambiguity about which rejection is the current one.

## Requirements

- The review model should have a void status in `reviewResult`.
- Previously submitted review results (both approvals and rejections) will be voided once a new rejection is in place.
  - Only results that existed **before** the incoming rejection are voided; the new rejection itself is never voided.
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

When a reviewer submits `result === "2"` (rejection), **before pushing the new result**, iterate `__review.reviewResults` and set `voided = true` and `voidedOn = <current timestamp>` on every entry that:
- has the same `v` (document version) as the incoming rejection, **and**
- is not already voided.

The void pass runs against the snapshot of results that existed before the new rejection is appended, so the new rejection is never included in the iteration and is never voided. After the pass, the new rejection is pushed as the sole active result for this version.

This keeps the operation scoped to the active review cycle and is safe to re-apply (idempotent per the terminal-state requirement).

The document version (`_v`) is **not** incremented on rejection. Since `_v` stays the same across the re-review cycle, the `voided` flag is the authoritative signal for excluding prior approvals in `allApproved()`.

### Approval check — `allApproved()` (`model/review.js`)

The existing method builds a per-reviewer map of latest results filtered by version. Extend the filter to also exclude entries where `voided === true`. This ensures a voided approval is never counted toward the approval threshold, even if version filtering alone would have caught it.

### View — review history (`views/form-builder.jade`, `views/released-form.jade`)

Split the rendered review results into two groups:

- **Active results** — entries where `voided` is absent or `false`. Rendered as today, unchanged.
- **Voided results** — entries where `voided === true`. Rendered in a separate section below the active results, collapsed by default. Each row shows the reviewer name, the original submitted date (`submittedOn`), and the voided date (`voidedOn`).

## Implementation

### 1. `model/review.js` — extend `reviewResult` schema

Add `voided` and `voidedOn` to the `reviewResult` schema (after `comment`):

```js
voided:   Boolean,
voidedOn: Date,
```

### 2. `model/review.js` — `addReviewResult()`

Void prior results **before** pushing the new rejection so that the new entry is never included in the iteration:

```js
if (result === '2') {
  const now = Date.now();
  doc.__review.reviewResults.forEach(r => {
    if (r.v === v && !r.voided) {
      r.voided = true;
      r.voidedOn = now;
    }
  });
  closeReviewRequests(doc);
  doc.__review.reviewRequests = [];
}

doc.__review.reviewResults.push({ reviewerId, result, comment, submittedOn: Date.now(), v });
```

### 3. `model/review.js` — `allApproved()`

Extend the version filter on line 177 to also exclude voided results:

```js
const currentReviewResults = reviewResults.filter(
  r => r.v === docVersion && !r.voided
);
```

### 4. `views/form-builder.jade` — review history section

In the "Completed review(s)" accordion body (around line 54), split the results into active and voided before iterating:

```jade
- var activeResults = review.reviewResults.filter(function(r) { return !r.voided; })
- var voidedResults = review.reviewResults.filter(function(r) { return r.voided; })

each result in activeResults
  //- existing per-result accordion markup unchanged

if voidedResults.length
  .accordion-group
    .accordion-heading
      a.accordion-toggle(data-toggle="collapse" data-parent="#reviews" href="#voided-results") Voided review(s)
    #voided-results.accordion-body.collapse
      .accordion-inner
        each result in voidedResults
          .accordion-group
            .accordion-heading
              | #{result.reviewerName || result.reviewerId}
              | &nbsp;#{result.result === '1' ? 'approved' : 'rejected'} on&nbsp;
              span.time #{result.submittedOn}
              | ,&nbsp;voided on&nbsp;
              span.time #{result.voidedOn}
```

## Alternatives Considered

TBD

## Open Questions

TBD
