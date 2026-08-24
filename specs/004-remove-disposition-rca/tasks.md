# Tasks: Remove Root Cause Analysis from CE/CS Disposition

**Input**: Design documents from `specs/004-remove-disposition-rca/`

**Amends**: `specs/001-ncr-workflow` — User Story 2

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: The single user story: CE/CS submits disposition without Root Cause Analysis

---

## Phase 1: Setup

*No setup required — this is an amendment to an existing, running application.*

---

## Phase 2: Foundational

*No blocking prerequisites — all changes are independent removals in separate files.*

---

## Phase 3: User Story 1 — CE/CS Submits Disposition Without Root Cause Analysis (Priority: P1)

**Goal**: Remove the Root Cause Analysis field from the disposition form, route
validation, service layer, and all display views. Existing database records are
unaffected.

**Independent Test**: Open the disposition form on a Submitted NCR — no Root
Cause field should appear. Submit with only Parts Disposition + Preventive
Actions and verify the NCR transitions to Dispositioned. Open NCR detail and
concurrence pages and confirm no Root Cause row is displayed.

### Implementation

- [ ] T001 [P] [US1] Remove the Root Cause Analysis fieldset, character-counter listener (`$('#root_cause_documentation').on('input',...)`), client-side validation (`rc.length < 50` check and error push), and `root_cause_documentation: rc` from the submission payload in `views/ncr-disposition.jade`
- [ ] T002 [P] [US1] Remove `root_cause_documentation: sanitizeStr(req.body.root_cause_documentation)` from the body-parse block and the `if (!b.root_cause_documentation || ...)` validation check (lines 178, 187–188) in `routes/ncr.js`
- [ ] T003 [P] [US1] Remove `root_cause_documentation: data.root_cause_documentation` from the `ncr.disposition` assignment and remove `root_cause_excerpt: data.root_cause_documentation.slice(0, 100)` from the `disposition.submitted` event payload in `lib/ncr-service.js`
- [ ] T004 [P] [US1] Remove the `if ncr.disposition.root_cause_documentation` conditional block and its `dt Root Cause` / `dd` display lines from `views/ncr-detail.jade`
- [ ] T005 [P] [US1] Remove the `dt Root Cause` and `dd= ncr.disposition.root_cause_documentation` lines from `views/ncr-concurrence.jade`
- [ ] T006 [P] [US1] Remove `root_cause_documentation` from all test fixtures in `test-unit/lib/ncr-service.test.js`; add a regression test asserting `submitDisposition` succeeds when `root_cause_documentation` is absent from the payload
- [ ] T007 [P] [US1] Update `e2e/us2-ce-cs-disposition.spec.js`: remove `ROOT_CAUSE_TEXT` constant; in AS2 assert `#root_cause_documentation` is **not** present in the DOM; remove all `root_cause_documentation` fills from the form-fill helpers; remove `root_cause_documentation` from all API call payloads; remove `root_cause_documentation` DB assertion and the `expect(body.details).toHaveProperty('root_cause_documentation')` server-bypass assertion

**Checkpoint**: All 7 files updated. Disposition form has no Root Cause field.
Unit tests pass. E2e suite passes (`npx playwright test us2-ce-cs-disposition.spec.js`).

---

## Phase 4: Polish & Verification

**Purpose**: Validate the complete change against the quickstart scenarios and confirm no regressions.

- [ ] T008 Run `TRAVELER_CONFIG_REL_PATH=docker npm test` and confirm all unit tests pass (no root_cause references in failing tests)
- [ ] T009 Run `npx playwright test e2e/us2-ce-cs-disposition.spec.js` and confirm all 8 tests pass
- [ ] T010 [P] Manually walk through `specs/004-remove-disposition-rca/quickstart.md` Scenarios 1–5 to confirm form, submission, and legacy-record rendering are all correct

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phases 1 & 2**: Skipped (no new infrastructure)
- **Phase 3 (US1)**: All 7 tasks are independent (different files) — run in any order or fully in parallel
- **Phase 4 (Polish)**: Depends on all Phase 3 tasks complete

### Within Phase 3

All tasks are marked **[P]** — they touch separate files with no shared state:

| Task | File | Layer |
|------|------|-------|
| T001 | `views/ncr-disposition.jade` | UI form |
| T002 | `routes/ncr.js` | Route/validation |
| T003 | `lib/ncr-service.js` | Service/business logic |
| T004 | `views/ncr-detail.jade` | UI display |
| T005 | `views/ncr-concurrence.jade` | UI display |
| T006 | `test-unit/lib/ncr-service.test.js` | Unit tests |
| T007 | `e2e/us2-ce-cs-disposition.spec.js` | E2e tests |

---

## Parallel Execution Example: Phase 3

```bash
# All 7 tasks can run simultaneously across different files:
Task T001: "Remove RCA fieldset from views/ncr-disposition.jade"
Task T002: "Remove RCA route validation from routes/ncr.js"
Task T003: "Remove RCA from service layer in lib/ncr-service.js"
Task T004: "Remove RCA display from views/ncr-detail.jade"
Task T005: "Remove RCA display from views/ncr-concurrence.jade"
Task T006: "Update unit test fixtures in test-unit/lib/ncr-service.test.js"
Task T007: "Update e2e assertions in e2e/us2-ce-cs-disposition.spec.js"
```

---

## Implementation Strategy

### MVP (only one user story — complete all of Phase 3)

1. Complete T001–T007 (can be done in any order; all are parallel-safe)
2. **VALIDATE**: `npm test` (unit) + `playwright test us2-ce-cs-disposition.spec.js` (e2e)
3. Walk quickstart.md Scenarios 1–5 in the browser
4. Done — this is the entire scope

### Key Constraints (from research.md)

- **Do NOT remove** `root_cause_documentation: String` from `model/ncr.js` — field must stay for backward compat
- **Do NOT remove** the `root_cause` dashboard filter in `lib/ncr-service.js` (lines 757–759) — historical records remain searchable
- Old NCR documents with populated `root_cause_documentation` must not crash any view page after T004/T005

---

## Notes

- All [P] tasks touch different files — safe to implement in any order
- `root_cause_documentation` stays in the DB schema; only the form, validation, and display change
- Commit after Phase 3 is fully complete and both test suites pass
