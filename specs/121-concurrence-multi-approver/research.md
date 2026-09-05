# Research: Concurrence Multi-Approver (No Role)

## Decision 1: Scope of the `approver_role` removal

**Decision**: Remove the role field from the QA concurrence UI input, route validation, and service persistence. Retain the `approver_role` field on the Mongoose schema (no migration) — it becomes an unused optional field on any new records.

**Rationale**: The schema field is harmless when absent (it is already `type: String` with no `required` constraint). Keeping it avoids a migration and preserves historical records where a role was captured. Removing it from the validation layer, service, and event payload is sufficient to fully drop the concept from the active flow.

**Alternatives considered**:
- Drop the schema field entirely: requires a migration and offers no benefit since the field is optional and unindexed.
- Make role optional in validation but keep the UI input: contradicts the spec requirement ("do not specify the role").

---

## Decision 2: Files requiring changes

| File | Layer | Change |
|------|-------|--------|
| `views/ncr-concurrence.jade` | View | Remove "Role" column header, role input field, role rendering in `render()`, role from push payload; update colspan 3→2; drop `!role` guard from add-click handler |
| `routes/ncr.js` | API validation | Remove `!a.approver_role` from per-entry validation (line ~306); update error message to reflect only `approver_id` is required |
| `lib/ncr-service.js` | Service | Remove `approver_role` from the mapped `additional_approvers` array (line ~283) and from the `qa.concurred` event payload (line ~304); remove stale `actor_role: approverEntry.approver_role` in `submitApproval` and `returnForComment` service functions (lines ~363, ~431) and corresponding payload fields |
| `model/ncr.js` | Schema | No change — `approver_role: String` is left as an inert optional field |

---

## Decision 3: Typeahead / username lookup

**Decision**: The existing Bloodhound typeahead already present on the NCR form (used for CE/CS selection) does not need to be wired up in this feature iteration. The plain text username input remains sufficient; the spec does not require autocomplete.

**Rationale**: Spec FR-001 says "add approvers by username" without mandating autocomplete. Adding typeahead is an enhancement beyond the current scope. The existing input flow already prevents adding a blank username.

---

## Decision 4: No new unit tests required beyond existing coverage

**Decision**: Update or add unit tests for `submitConcurrence` in the existing test suite to cover the no-role scenario (entries with only `approver_id`). No new test infrastructure is needed.

**Rationale**: The constitution mandates tests for bug fixes and new feature logic. The change to `submitConcurrence` is a simplification — dropping a field — and the existing test file for ncr-service is the right home for the regression scenario.
