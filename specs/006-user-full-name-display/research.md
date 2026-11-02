# Phase 0 Research: Show People's Full Names Instead of Initials or User IDs

All Technical Context fields in plan.md were resolvable directly from the existing codebase and constitution — this is an extension of a mature application, not a greenfield choice of stack. Research here instead works out the *mechanism* for a feature that touches an unusually wide number of call sites, and resolves a scope question the spec's literal wording left open.

## Decision 1: One shared, request-scoped batch resolver, not Mongoose virtuals

**Decision**: Add `lib/user-names.js`, exposing a function that takes a list of account identifiers and returns a `Map` (or plain object) from identifier to full name, falling back to the identifier itself when no `User` document or no `name` is found. It issues exactly one `User.find({_id: {$in: distinctIds}}, 'name')` per call. Every read path that needs names collects its own distinct ids first, calls this once, then decorates its own rows/locals/CSV cells.

**Rationale**: The person-identifying fields are read through three fundamentally different mechanisms in this codebase:
- plain `Model.find(...).exec()` / `.lean()` — used by the ~20 internal `/*/json` DataTables sources (`routes/form.js`, `routes/traveler.js`, `routes/binder.js`, `routes/review.js`) and by `routes/api.js`'s `/apis/travelers/`, `/apis/travelers/:id/`, `/apis/forms/`, `/apis/binders/`, `/apis/releasedForms/`,
- `Model.aggregate(...)` — used exclusively by `lib/public-travelers.js`, which returns plain JS objects with no Mongoose document wrapper, hooks, or virtuals at all,
- direct Jade interpolation of a value already loaded onto `res.locals`/`locals.traveler` etc. for a single-record detail page.

Mongoose virtual-populate plus `pre('find')` query middleware (the idiomatic "composable schema mixin" shape used by `addReview`/`addShare`) would cover only the first mechanism, and only for fields that are not inside array subdocuments without extra per-path configuration (`sharedWith[]._id`, `reviewRequests[]._id`, `work[].addedBy` are all array-subdocument fields). It would not run at all for `.aggregate()` or `.lean()`, and provides nothing for Jade locals. A single plain-JS function, called explicitly wherever a response is assembled, works identically across all three mechanisms, is trivially unit-testable in isolation (consistent with "every new `lib/` function MUST have corresponding tests"), and keeps the logic in exactly one place rather than three.

**Alternatives considered**:
- *Mongoose `ref` + virtual populate + query middleware mixin.* Rejected: doesn't reach `.aggregate()` (the public travelers path) or plain Jade locals, and would still need per-schema configuration for every array-subdocument field, giving no real reduction in touched call sites over the plain-function approach while adding Mongoose-specific indirection.
- *Override `res.json` globally to auto-decorate any array of docs.* Rejected: implicit and hard to reason about (it would need a naming convention to guess which fields are "person" fields on an arbitrary payload), and does nothing for CSV or Jade.
- *Resolve names client-side* (ship raw ids, have the browser look them up). Rejected: multiplies round trips per page, and the REST API's external consumers would still only see raw ids unless the API itself changed — doesn't satisfy FR-002/FR-007 either.

## Decision 2: Additive field everywhere, except one explicit CSV substitution

**Decision**: Every call site adds a sibling field/local — e.g. `createdByName` next to `createdBy` — rather than changing what the existing field contains. The one exception is the public travelers list's CSV export, where the "created by"/"updated by" *cell values* are replaced with the resolved name (column header text stays `createdBy`/`updatedBy`, matching the project's existing convention of naming CSV columns after the underlying field — see commit `#240`).

**Rationale**: This single rule satisfies FR-002, FR-003, FR-004, FR-006, and FR-007 at once, for both the genuinely external REST API (`routes/api.js`, documented in `views/docs/api/`) and the internal-only `/*/json` endpoints, without needing to treat them differently at the wire-contract level — "never repurpose an existing field, always add one" is simply a universally safe, low-risk convention, so there is no need for two different mechanisms depending on who the consumer is. The CSV exception is scoped narrowly and intentionally, per the 2026-11-01 clarification session, to `lib/public-travelers.js`'s own `toCsv()`/`CSV_COLUMNS` — it does **not** extend to `lib/csv.js`'s `RECORD_COLUMNS`/`recordCell`, which also backs the separate single-traveler detail CSV export (`buildTravelerCsv`/`TRAVELER_COLUMNS`); that export was not named in the clarification and is treated as a distinct, out-of-scope CSV surface for this feature.

**Alternatives considered**: Changing the existing field's value directly everywhere (rejected for the REST API per FR-007/constitution; rejected even internally for consistency — silently repurposing a field that other code may still read as a raw identifier, such as row-selection or linking logic elsewhere in `table.js`, would be a surprising, undocumented change for no benefit over adding a field). Note that this decision governs the *wire data* only: the client-side `personColumn` renderer separately switches its own sort/filter/display behavior to the resolved name, per FR-005 (see `contracts/internal-json-endpoints.md`) — the field sent over the wire stays additive even though the column's on-screen sort/filter behavior changes.

## Decision 3: Scope includes the Jade detail-page occurrences discovered during research

**Decision**: `views/traveler.jade`, `views/traveler-viewer.jade`, `views/traveler-print.jade`, `views/traveler-config.jade`, `views/form-config.jade`, `views/binder-config.jade`, and `views/binder.jade` — each of which interpolates a raw account id directly (e.g. `p Created by #{traveler.createdBy}`) on a single-record detail/config page — are in scope for this feature, even though spec.md's User Stories literally describe "list/table views" and "the public travelers dashboard."

**Rationale**: These are additional, previously undiscovered instances of the exact "bare account identifier" display pattern the spec names (not a new pattern), and FR-006 commits to consistency "everywhere the current avatar-icon or bare-account-identifier display pattern is used today." Leaving them out would recreate, on pages immediately adjacent to the ones explicitly fixed, the same problem this feature exists to solve. This is a plan-time judgment call (not a spec defect needing a new `/speckit-clarify` round) and is called out here, and in plan.md's Technical Context, for visibility.

**Alternative considered**: Hold strictly to the literal "list/table view" + "dashboard" wording and leave these seven Jade pages untouched. Rejected as inconsistent with FR-006 and likely to surprise the requester, who described the problem generally ("the user is either displayed with... Make a change to display the user's full name") rather than enumerating specific pages.

## Decision 4: `lib/public-travelers.js` takes its name resolver as an injected dependency

**Decision**: Rather than `require('../model/user')` directly inside `lib/public-travelers.js`, the name-resolution step is passed in (e.g. as part of the existing `options` parameter to `listHandler`, or an added parameter), with a default that uses the real `User` model when the caller doesn't supply one.

**Rationale**: The module's own documentation states it has "no dependency on a server or on a live database connection... so tests can pass a fake," and its existing test (`test/lib/public-travelers-test.js`) asserts the fake `Traveler` model's `aggregate` is the *only* method ever called — proving the module doesn't reach for anything else. Requiring the real `User` model at the top of the file would silently break that guarantee and couple a deliberately DB-connection-agnostic module to a live Mongoose connection. Both call sites (`routes/api.js`'s `/apis/publictravelers/`, `routes/traveler.js`'s web route) already pass an `options` object today, so threading the dependency through costs each call site one line.

**Alternative considered**: `require('../model/user')` directly. Rejected for the reason above; would also force the existing test file to be rewritten around a real or mocked Mongoose connection instead of a simple fake.

## Decision 5: Fallback and case handling match existing conventions

**Decision**: The resolver looks up `User` by the identifier exactly as stored (no case transformation at the resolver boundary); any caller that already normalizes case before storing/comparing identifiers (e.g. `lib/review.js:12`'s `User.findById(uid.toLowerCase())`) continues to do so before calling the resolver. When no matching `User` document exists, or the document has no `name` value, the resolver's map entry for that id is simply the id itself — so every call site's fallback behavior (FR-003) is "use what the resolver returned" with no special-casing needed at the call site.

**Rationale**: Keeps the resolver a pure, small function (easy to test) and avoids guessing at a normalization rule that might not hold for every caller; existing case-normalization precedent already lives at the few call sites that need it.
