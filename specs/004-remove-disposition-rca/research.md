# Research: Remove Root Cause Analysis from CE/CS Disposition

**Date**: 2026-08-22

No external research required — the change is fully defined by the spec and the
existing codebase. All decisions below are resolved from reading the source.

---

## Decision 1: Schema field retention

**Decision**: Keep `root_cause_documentation: String` in `model/ncr.js` — do not remove it.

**Rationale**: Existing NCR documents in the database may already have this field
populated. Removing it from the Mongoose schema would cause Mongoose to silently
strip the value on any subsequent save of those documents, corrupting historical
data. Keeping the field in the schema as an un-validated, un-required String means
existing values are preserved and any view code that guards with `if
ncr.disposition.root_cause_documentation` will continue to work safely on old
records.

**Alternatives considered**:
- Remove from schema → rejected (data loss on re-save of old documents)
- Add schema migration to null out old values → rejected (no business need; old
  data is harmless)

---

## Decision 2: Dashboard root_cause filter

**Decision**: Retain the `root_cause` query-parameter filter in `listNcrs`
(`lib/ncr-service.js` lines 757–759).

**Rationale**: Existing closed/archived NCRs may have root cause data. The
dashboard filter lets QA staff search those historical records. Removing the
filter would break any bookmarked dashboard URL that includes `root_cause=`.

**Alternatives considered**:
- Remove the filter → rejected (breaks historical search)
- Deprecate the filter → out of scope for this change

---

## Decision 3: Event payload — root_cause_excerpt

**Decision**: Remove `root_cause_excerpt` from the `disposition.submitted` event
payload in `lib/ncr-service.js` (line 205). Do not replace it with a placeholder.

**Rationale**: The event is append-only and already has `parts_disposition` and
`preventive_action_count` to summarise the submission. Keeping a
`root_cause_excerpt` field (even as `null`) on new events would be misleading.
Old events that already have the field are unaffected — the event schema is
schema-less (plain Object) and old values remain intact.

**Alternatives considered**:
- Set `root_cause_excerpt: null` → rejected (misleading; field no longer has meaning)
- Keep field but set it from preventive actions → rejected (scope creep)

---

## Decision 4: View backward compatibility

**Decision**: In `ncr-detail.jade` the existing `if ncr.disposition.root_cause_documentation`
guard already prevents a crash for new records that lack the field. Remove the
entire `if` block (including the guard) since the field will never be populated
going forward, and new views should not display it at all.

In `ncr-concurrence.jade`, the current display is unguarded
(`dd= ncr.disposition.root_cause_documentation`). Remove the `dt`/`dd` pair
entirely — the field is already absent on new records and the view does not
need to display it for old records in the concurrence context.

**Rationale**: The concurrence page is only reached for NCRs that were dispositioned
_after_ this change. Old records that already went through the full workflow
(disposition → concurrence → approval) are already closed and the concurrence page
is no longer relevant to them.

**Alternatives considered**:
- Guard concurrence display with `if ncr.disposition.root_cause_documentation` →
  acceptable for old records but adds dead code; rejected in favour of a clean removal

---

## Decision 5: e2e test updates

**Decision**: Update `e2e/us2-ce-cs-disposition.spec.js` to:
1. Remove `ROOT_CAUSE_TEXT` constant
2. AS2 (form fields present): assert `#root_cause_documentation` is **not** visible
3. AS3 (Rework requires instructions): remove root_cause fill from helper
4. AS4/AS5 (full submission): remove `root_cause_documentation` from all payloads
   and from the DB assertion
5. Server-bypass test: remove `root_cause_documentation: 'too short'` and the
   `expect(body.details).toHaveProperty('root_cause_documentation')` assertion

**Rationale**: The e2e suite must match the new contract. A test that fills a
removed field would fail immediately; a test that asserts the field is NOT present
is the correct regression guard going forward.
