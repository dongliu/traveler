# Phase 0 Research: Backfill Traveler Classification Metadata

The spec has no `[NEEDS CLARIFICATION]` markers. This document records the design decisions needed to turn the spec's functional requirements into an implementation approach, since several reasonable approaches exist for each.

## 1. Where the backfill logic lives

**Decision**: A new small `lib/` function (`lib/traveler-metadata.js`, exporting `backfillFromReleasedForm(releasedForm)`), called from the existing `updateMetadata` handler for `PUT /released-forms/:id/metadata` in `routes/form-management.js`, immediately after `f.saveWithHistory(...)` succeeds and before the response is sent.

**Rationale**: The constitution's Development Workflow requires new `lib/` functions to have a corresponding Mocha test in `test/lib/`; extracting the logic keeps the route handler thin and the backfill behavior independently testable, matching how `lib/review.js` already centralizes mutation logic shared/reused across routes.

**Alternatives considered**:
- *Inline in the route handler* — rejected; harder to unit-test in isolation and would make an already-compact handler noticeably longer.
- *Mongoose `pre`/`post` save hook on `ReleasedForm`* — rejected; hooks fire on every save, including the initial release-time save (when no travelers exist yet) and the `/status` (archive) save, making the trigger condition for this specific side effect less explicit than an explicit call from the one route that actually changes classification metadata.

## 2. Matching "travelers created from this released form, including version string"

**Decision**: `Traveler.find({ referenceReleasedForm: releasedForm._id, referenceReleasedFormVer: releasedForm.ver })`.

**Rationale**: These are exactly the two fields the codebase already writes, once, onto a traveler at creation time (`utilities/routes.js`, `createTraveler`) to record which released form it came from. Matching both — not just the id — directly satisfies the feature request's explicit call-out of the version string, and is defensive: today a given `ReleasedForm` document has exactly one immutable `ver` (set once in `routes/form.js`'s `releaseForm()` and never reassigned), so the two queries are equivalent in practice, but matching both fields guards against ever treating a traveler as "from" a released form based on id alone.

**Alternatives considered**: Matching on `referenceReleasedForm` alone — rejected as less precise than what was asked for, even though it would currently return the same set.

## 3. Per-field conditional update and persistence

**Decision**: For each traveler found, evaluate `subsystem`, `device`, and `activity` independently; for each field that is currently blank (`''`, `null`, or `undefined`) and for which the released form's corresponding value is non-blank, set the traveler's field to the released form's value. Call plain `doc.save()` once per traveler that had at least one field change; skip the save entirely for travelers where nothing changed.

**Rationale**: `Traveler` has no `addHistory`/`saveWithHistory` plugin anywhere in this codebase (confirmed in `model/traveler.js`; also noted as a correction in spec 003's `tasks.md`), so plain `.save()` is already the established mutation pattern for this model — there is no history requirement to satisfy or bypass. Per-field independence directly implements FR-002/FR-003. Skipping the save when nothing changed avoids pointless writes and keeps `updatedOn`/`updatedBy`-style bookkeeping (none of which exists for these fields today) honest.

**Alternatives considered**: A single bulk `updateMany` using an aggregation-pipeline update (`$set` with `$cond` per field) — rejected; correctly expressing "only set field X if it is currently blank" independently for three fields in one bulk operation adds real complexity and a MongoDB feature-version dependency, for a change with no stated performance requirement beyond "no noticeable delay" (SC-004) at the scale this system actually sees.

## 4. Execution timing

**Decision**: Run the backfill synchronously, inside the same request that handles `PUT /released-forms/:id/metadata`, after the released form itself is saved and before the 200 response is returned.

**Rationale**: The spec's Assumptions state the owner/admin should only see success once eligible travelers have already been corrected. This also matches the existing handler's shape (`await f.saveWithHistory(...)` then respond).

**Alternatives considered**: Asynchronous/background processing — rejected; this codebase has no job queue or worker infrastructure, and introducing one would be disproportionate to a change expected to touch a modest number of documents per request.
