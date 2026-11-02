# Phase 1 Data Model: Show People's Full Names Instead of Initials or User IDs

No persisted schema changes. This document enumerates the existing entities and fields this feature reads, and defines the one new, purely-derived concept it introduces.

## Existing entity: Person (`model/user.js`)

| Field | Type | Role in this feature |
|---|---|---|
| `_id` | String | The account identifier already shown today (as an avatar initial or bare id). Lookup key. |
| `name` | String | The full name to display. Already populated from the organization's identity source (AD `displayName`) by `lib/auth.js`, `routes/user.js`, `lib/share.js`, `routes/group.js` — this feature only reads it, never writes it. |

**Validation / edge rule**: a `Person` may exist with no `name` (never synced, or blank), or an identifier referenced elsewhere may match no `Person` at all (e.g. a removed account referenced by old history). Both cases resolve to the identifier itself (FR-003) — there is no "unknown person" sentinel value.

## Existing entity: Attributed Record

Not a single model — the role is played by `Form`, `Traveler`, `Binder`, `ReleasedForm`, and the `Review` mixin, each of which stores one or more plain-String fields that are a `Person`'s identifier. None of these fields are changed by this feature (still plain `String`, no `ref`, no new index):

| Model | Field | Shape | Notes |
|---|---|---|---|
| `Form` (`model/form.js`) | `createdBy`, `updatedBy`, `owner` | top-level String | `owner` falls back to `createdBy` when absent (existing behavior, unchanged) |
| `Traveler` (`model/traveler.js`) | `createdBy`, `clonedBy`, `updatedBy`, `owner` | top-level String | same `owner` fallback |
| `Traveler` (`model/traveler.js`) | `inputBy` | String, inside each traveler-data entry | per-field submission history, not a top-level traveler attribute |
| `Binder` (`model/binder.js`) | `createdBy`, `clonedBy`, `updatedBy`, `owner` | top-level String | |
| `Binder` (`model/binder.js`) | `addedBy` | String, inside each `work` array item | one per traveler/binder added to the binder |
| `ReleasedForm` (`model/released-form.js`) | `releasedBy`, `archivedBy` | top-level String | |
| `Review` mixin (`model/review.js`) | `reviewRequests[]._id` | String (doubles as the array item's own `_id`) | the reviewer being asked |
| `Review` mixin (`model/review.js`) | `reviewResults[].reviewerId` | top-level-of-subdocument String | the reviewer who answered |

## New, derived concept: Resolved Display Name

Not a database field. A value computed at read time, per response, from the `Person.name` lookup described in research.md's Decision 1, and attached to the outgoing payload next to the identifier it describes.

| Property | Value |
|---|---|
| **Persistence** | None. Never written to MongoDB. Recomputed on every read, so it always reflects the `Person`'s *current* name (FR-004) — a traveler created last year by someone whose name has since changed shows the new name, not a snapshot. |
| **Naming convention** | `<field>Name`, e.g. `createdBy` → `createdByName`, `updatedBy` → `updatedByName`, `reviewerId`/reviewer `_id` → `reviewerName`, `inputBy` → `inputByName`, `addedBy` → `addedByName`. |
| **Value when resolvable** | The matching `Person.name`. |
| **Value when not resolvable** | The original identifier (FR-003) — so a consumer that only reads `<field>Name` never sees an empty or missing value. |
| **Relationship** | Many-to-one: many Attributed Record fields across many records can resolve to the same `Person`; the resolver (Decision 1) batches by *distinct* identifier per response specifically because of this fan-in. |

### Where it is attached, by surface

| Surface | Attachment point | Existing field left unchanged? |
|---|---|---|
| Internal `/*/json` DataTables sources (forms/travelers/binders/reviews/released-forms lists) | New sibling field on each returned record, read by `personColumn`'s renderer | Yes |
| `/apis/publictravelers/` and `/publictravelers/list` (JSON) | New sibling field(s) on each `toRecord()` output (`createdByName`, `updatedByName`, `ownerName`) | Yes (FR-007) |
| `/apis/publictravelers/` CSV export | **Substituted** into the `createdBy`/`updatedBy` cell values (column header unchanged) | No — the one explicit exception (FR-008) |
| `/apis/travelers/`, `/apis/travelers/:id/` (and other `routes/api.js` JSON endpoints exposing these fields) | New sibling field(s) | Yes (FR-007) |
| Jade detail pages (`traveler.jade` etc., see research.md Decision 3) | New template local passed alongside the existing one | Yes — the raw identifier remains available to the template even though the page now displays the name |

## State / lifecycle

None introduced. This feature adds no new states, transitions, or stored audit entries; `saveWithHistory` is not invoked anywhere by this change.
