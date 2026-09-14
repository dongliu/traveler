# Tasks: Admin NCR Deletion

**Input**: Design documents from `specs/122-admin-delete-ncrs/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: The single user story: Admin Deletes One or More NCRs from the Dashboard

## Path Conventions

Single Express MVC project at repo root — extends the existing `lib/`, `routes/`, `views/`, `test-unit/`, `e2e/` from `001-ncr-workflow`. No new top-level directories, no new collection.

---

## Phase 1: Setup

*No setup required — this feature extends existing files in a running application; no new dependencies, no new top-level directories.*

---

## Phase 2: Foundational

*No blocking prerequisites — there is a single user story, and its own implementation tasks (below) are the only work this feature requires.*

---

## Phase 3: User Story 1 — Admin Deletes One or More NCRs from the Dashboard (Priority: P1) 🎯 MVP

**Goal**: An admin can select one or more NCRs on the dashboard and permanently delete them — record and attached files — in one confirmed action. No other role sees or can invoke this capability.

**Independent Test**: Log in as an admin, select one or more NCRs (including one with an attachment and one in "Closed" status) on the dashboard, confirm deletion, and verify the selected NCRs and their attachment files no longer exist anywhere in the system while unrelated NCRs are unaffected; separately confirm a non-admin sees no delete controls and a direct API call from a non-admin is rejected.

### Tests for User Story 1 ⚠️

> Write these tests first; confirm they fail against the not-yet-implemented `deleteNcr` before starting implementation.

- [ ] T001 [P] [US1] Unit test in `test-unit/lib/ncr-service.test.js`: `deleteNcr(ncrId, user)` rejects with `err.status === 403` when `user.roles` does not include `'admin'`, and does not call `Ncr.findById` (checked before any lookup, per data-model.md)
- [ ] T002 [P] [US1] Unit test in `test-unit/lib/ncr-service.test.js`: `deleteNcr(ncrId, {roles:['admin']})` rejects with `err.status === 404` when `Ncr.findById` resolves `null`
- [ ] T003 [P] [US1] Unit test in `test-unit/lib/ncr-service.test.js`: `deleteNcr` on an NCR with two `attachments[]` entries calls `fs.promises.unlink` once per entry's `file_path` (stub `fs.promises.unlink`) and deletes the document (stub `Ncr.prototype.deleteOne`) — assert both were called, regardless of the NCR's `status` (include a case with `status: 'Closed'` per FR-011)
- [ ] T004 [P] [US1] Unit test in `test-unit/lib/ncr-service.test.js`: when a stubbed `fs.promises.unlink` rejects (e.g., `ENOENT`) for one attachment, `deleteNcr` still resolves successfully and still deletes the document — the unlink failure is not thrown

### Implementation for User Story 1

- [ ] T005 [US1] Add `const fs = require('fs');` and `const path = require('path');` to the top of `lib/ncr-service.js`, then implement and export `deleteNcr(ncrId, user)`: throw `{status:403}` if `!(user.roles||[]).includes('admin')`; `Ncr.findById(ncrId)`, throw `{status:404}` if not found; for every entry in `ncr.attachments || []`, `await fs.promises.unlink(path.resolve(a.file_path)).catch(err => logger.error(...))` (best-effort, per research.md Decision 3 — never throws); finally `await ncr.deleteOne();`. Add `deleteNcr` to the `module.exports` block alongside the other service functions (depends on T001–T004 existing and failing first)
- [ ] T006 [US1] In `routes/ncr.js`: import `deleteNcr` from `../lib/ncr-service`; add `router.delete('/:id', auth.ensureAuthenticated, async (req, res) => {...})` — validate `:id` via the existing `isValidId()`/`badId()` helpers, build `user = {id: req.session.userid, name: res.locals.username, roles: res.locals.roles || []}` (same shape every other handler in this file already builds), call `await deleteNcr(req.params.id, user)`, return `res.status(200).json({success:true, message:'NCR deleted successfully.'})` on success, `mapServiceError(err, res, 'NCR deletion')` on failure — per `contracts/ncr-delete.json` (depends on T005)
- [ ] T007 [P] [US1] Add a `file-exists` command to `e2e/fixtures/cli.js`'s `COMMANDS` map: `async function fileExists({ filePath }) { return { exists: fs.existsSync(filePath) }; }`, requiring `fs` at the top of the file if not already imported, registered as `'file-exists': fileExists` alongside the existing `get-ncr`/`get-user` commands
- [ ] T008 [US1] In `views/ncr-dashboard.jade`: add `- var isAdmin = roles && roles.indexOf('admin') !== -1` near the top of `block content`; if `isAdmin`, add a checkbox `th` as the first column of `table#ncr-table`'s `thead tr` (an unchecked "select all" checkbox, `#select-all-ncrs`) and add a `button#delete-selected-btn.btn.btn-danger` (initially `disabled`) to the toolbar next to "New NCR" — both entirely absent from the rendered HTML when `!isAdmin`, not merely hidden with CSS (per FR-002)
- [ ] T009 [US1] In `views/ncr-dashboard.jade`'s script block: add a module-scope `var selectedIds = new Set();`; if admin controls are present, prepend a checkbox `<td><input type="checkbox" class="ncr-row-select" data-id="' + n._id + '"></td>` to each row inside `renderRows()`; wire `#select-all-ncrs` to check/uncheck every currently-rendered `.ncr-row-select` and add/remove their ids from `selectedIds`; wire each `.ncr-row-select`'s `change` event to add/remove its own id from `selectedIds`; enable `#delete-selected-btn` only when `selectedIds.size > 0` (depends on T008)
- [ ] T010 [US1] In `views/ncr-dashboard.jade`'s script block: wire `#delete-selected-btn`'s click handler — build the list of selected NCRs' `ncr_number` values from the currently-rendered rows (for the confirmation message), `if (!window.confirm('Permanently delete ' + selectedIds.size + ' NCR(s): ' + numbers.join(', ') + '? This cannot be undone.')) return;`, then issue one `$.ajax({method:'DELETE', url: prefix + '/api/ncrs/' + id})` per id in `selectedIds` (e.g. via `Promise.all` over jQuery deferreds), tally successes vs. failures (capturing each failure's `resp.message`), show a summary alert banner (e.g. "3 of 4 NCRs deleted. 1 failed: NCR-2026-0012 — NCR not found: ..."), clear `selectedIds`, uncheck `#select-all-ncrs`, and call the existing `load()`/`loadCounts()` to refresh the table (depends on T006, T009)

**Checkpoint**: An admin can select and permanently delete one or more NCRs (including a Closed one, including one with attachments) from the dashboard; a non-admin sees no controls and is rejected server-side on a direct call. This is the entire feature — independently testable and demoable now.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification of the complete change, and a regression check against the existing suite.

- [ ] T011 [P] Create `e2e/us-admin-ncr-deletion.spec.js`: (a) as admin, create an NCR with an uploaded attachment, capture its `file_path` via `execFixtureCli('get-ncr', {ncrId, fields:['attachments']})`, delete it from the dashboard, confirm the summary banner and that the row is gone, confirm `GET /ncrs/<id>` now 404s, and confirm `execFixtureCli('file-exists', {filePath})` now returns `{exists:false}`; (b) select 2–3 NCRs at once and confirm the batch summary reports the correct count; (c) as a non-admin (`SECONDARY_AUTH_STATE`), load the dashboard and assert the checkbox column/`#delete-selected-btn` are absent from the DOM, then `DELETE /api/ncrs/<id>` directly and assert `403` with the NCR still existing afterward; (d) delete an NCR in `Closed` status and confirm it succeeds like any other status (FR-011); (e) delete the same id twice in the same batch (simulating a race) and confirm the second call 404s while a sibling deletion in the same batch still succeeds
- [ ] T012 Run `TRAVELER_CONFIG_REL_PATH=docker npx mocha test-unit/lib/ncr-service.test.js` and confirm all tests pass, including the new `deleteNcr` block and no regressions in existing describe blocks
- [ ] T013 Run `npx playwright test us-admin-ncr-deletion.spec.js` (from `e2e/`, Docker stack running) and confirm all tests pass
- [ ] T014 [P] Manually walk through `specs/122-admin-delete-ncrs/quickstart.md` steps 1–10 to confirm the UI behavior (checkbox visibility, confirmation dialog wording, summary banner, 404s afterward) matches what the automated tests assert

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, no new files/dependencies
- **Foundational (Phase 2)**: None — skipped, single user story
- **User Story 1 (Phase 3)**: T001–T004 (tests) before T005 (implementation they cover); T005 before T006 (route calls the service function); T006 and T009 both required before T010 (the click handler needs both the endpoint and the selection state to exist); T007 is independent of T005/T006/T008–T010 and can happen any time before T011
- **Polish (Phase 4)**: Depends on all of Phase 3 being complete

### Within User Story 1

- Tests (T001–T004) before implementation (T005) — TDD per the constitution's "Automated Testing" principle
- Service layer (T005) before route (T006) before UI wiring that calls the route (T010)
- Dashboard markup (T008) before dashboard selection JS (T009) before the delete-click handler (T010)

### Parallel Opportunities

- T001, T002, T003, T004 can all be written in parallel (independent test cases against the same not-yet-written function)
- T007 (fixture CLI command) can be done in parallel with T005/T006/T008–T010 — it touches a different file and nothing else depends on it until T011
- T014 can be prepared in parallel with T012/T013, though running T012 before T011/T013 catches a regression more cheaply

---

## Parallel Example: Phase 3 tests

```bash
# All four unit tests can be written in parallel before T005 exists:
Task T001: "deleteNcr 403-for-non-admin unit test"
Task T002: "deleteNcr 404-for-missing-NCR unit test"
Task T003: "deleteNcr unlinks every attachment + deletes document (incl. Closed status) unit test"
Task T004: "deleteNcr tolerates a failing/missing unlink unit test"

# T007 is independent of the T005/T006 implementation work:
Task T007: "add file-exists command to e2e/fixtures/cli.js"
```

---

## Implementation Strategy

### MVP First (and only) — User Story 1

1. Complete Phase 3 (T001–T010) — this is the entire feature
2. **STOP and VALIDATE**: run quickstart.md's manual steps 1–10
3. Complete Phase 4 (T011–T014) for full automated coverage
4. Deploy/demo

### Key Constraints (from research.md and data-model.md)

- The admin check MUST live in `lib/ncr-service.js` (T005), not as `reqUtils.requireAdmin()` route middleware — keeps the JSON error envelope consistent with every other endpoint in `routes/ncr.js` (research.md Decision 1)
- A failing or missing attachment unlink MUST NOT block document deletion (T005, tested by T004) — per the edge case in spec.md
- Deletion MUST succeed regardless of NCR `status`, including `'Closed'` (T003/T011c) — per FR-011
- Nothing is written to any collection to record the deletion itself (no task adds one) — per FR-012's resolved clarification
- The checkbox column and delete button MUST be absent from the rendered HTML for a non-admin (T008), not merely hidden by CSS — per FR-002

---

## Notes

- [P] tasks touch different files (or independent test cases in the same file) with no unfinished dependency between them
- [US1] labels every Phase 3 task, since this feature has exactly one user story
- Commit after the Phase 3 checkpoint is reached and its tests pass, and again after Phase 4
- This is a small, single-story feature — there is no meaningful "MVP subset" narrower than the whole story; T001–T010 must all land together for the feature to be usable at all
