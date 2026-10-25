# Tasks: Reposition and Permission-Gate the NCR Next-Action Button

**Input**: Design documents from `specs/128-ncr-action-button-visibility/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Included. Constitution (I. Automated Testing) requires tests for every new feature. No `views/*.jade` file has existing unit-test coverage in this codebase (research.md's Testing section) — Playwright e2e is the right level here, the same way client-only logic elsewhere in this app (e.g. `public/javascripts/lib/live-refresh.js`) is verified at the e2e level rather than unit level.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[US1]/[US2]**: Map to spec.md's two user stories (Reposition the button / Permission-gate the button)
- Paths are repo-root relative.

## Path Conventions

Single Express MVC project at repo root — extends the existing `views/`, `e2e/`. No new route, no new client-side script, no schema change, no new dependency.

## Identifiers the tasks share

| Where | Identifier |
|---|---|
| File touched | `views/ncr-detail-body.jade` only |
| New booleans (declared at the top, alongside the existing `canManageApprovers`, line 1) | `canCreateDisposition`, `canConcur`, `canApprove`, `canClose` — see data-model.md for each one's exact condition |
| Removed | The `.span4.text-right` block (lines 9-17) beside the NCR number |
| New block | `.row-fluid > .span12`, left-aligned, inserted immediately before the Event Timeline `.row-fluid` (currently starting at line 261), gated on `canCreateDisposition \|\| canConcur \|\| canApprove \|\| canClose` |
| E2E personas (matching `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`'s own documented convention) | `dong` = primary, QA staff (`ncr-qa` member); `bob` = secondary, also a pre-existing `ncr-qa` member in this dev DB (temporarily removable via the existing `remove-group-member`/`add-group-member` fixtures); `guobao` = a real AD identity used as Originator/CE/CS context, never logged in as |
| Reused e2e fixtures | `create-traveler-linked-ncr`, `set-ncr-status`, `remove-group-member`, `add-group-member` (all already in `e2e/fixtures/cli.js`) |

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before changing anything. No new dependency to install.

- [ ] T001 Confirm the Docker stack is up (`docker compose up`); run `npm run e2e -- e2e/us3-qa-concurrence-and-approver-coordination.spec.js` (the closest existing coverage — it already exercises `dong`-as-QA-staff and `bob`-as-approver on this same page) and record its result in `specs/128-ncr-action-button-visibility/baseline.txt`. Note any pre-existing failure by name so it is not misattributed later.

---

## Phase 2: User Story 1 — The next-action button moves to the bottom of the page (Priority: P1) 🎯 MVP

**Goal**: The button offering the NCR's next workflow action no longer sits beside the NCR number; it sits left-aligned, directly above Event Timeline.

**Independent Test**: spec.md User Story 1's own Independent Test.

### Tests for User Story 1 ⚠️

> Write first; confirm it fails before implementing.

- [ ] T002 [US1] Create `e2e/us-ncr-next-action-visibility.spec.js` (header comment and `runId`/`execFixtureCli` imports in the style of `e2e/us3-qa-concurrence-and-approver-coordination.spec.js`; reuse that file's `QA_STAFF_ID = 'dong'`/`APPROVER_ID = 'bob'` convention). Add a helper `createNcrInStatus(status, overrides)` wrapping `create-traveler-linked-ncr` (originator `guobao`, ce_cs `dong`) + `set-ncr-status`, parameterized by target status and any extra fields (e.g. `additional_approvers`). Add `test.describe('US1 — button repositioned')` with one test: create an NCR in `Submitted` status with `dong` as CE/CS, `page.goto` its detail page as `dong`, and assert (a) no `a:has-text("Create Disposition")` exists inside the header row next to the NCR number (scope the negative assertion to a locator for that row, not the whole page, so it actually proves the old position is empty rather than merely that the button exists somewhere), and (b) `a:has-text("Create Disposition")` **is** present, and appears after the Event Timeline fieldset's start in document order but visually above it (assert via `page.locator('a:has-text(\"Create Disposition\")')`'s bounding box `y` versus `#event-timeline`'s legend's bounding box `y` — the button's `y` must be less than the Event Timeline legend's `y`, i.e. above it, while still being below the header `h3`'s `y`).

### Implementation for User Story 1

- [ ] T003 [US1] In `views/ncr-detail-body.jade`, remove the `.span4.text-right` column (lines 9-17) from the top header `.row-fluid`, leaving only `.span8` (the `h3`/NCR-number/status-badge) in that row. (makes part of T002 pass — the "not in the header" half)
- [ ] T004 [US1] In the same file, immediately before the `.row-fluid` that starts Event Timeline (currently line 261), insert a new `.row-fluid` containing a `.span12` with the four `if`-gated `a.btn...` lines moved from the removed block verbatim (same labels, hrefs, Bootstrap classes — `btn-primary`/`btn-success`/`btn-warning`/`btn-danger` — only their container changed, per FR-002). At this task, keep the original bare `if ncr.status === '...'` conditions (User Story 2 replaces them with the `can*` booleans) — this task is positioning only. (makes the rest of T002 pass)

**Checkpoint**: User Story 1 is functional and independently testable — the button has moved, with no change yet to who sees it.

---

## Phase 3: User Story 2 — Only someone who can actually perform the action sees its button (Priority: P2)

**Goal**: Each action's button is shown only to a viewer authorized for that specific action, per data-model.md's four conditions.

**Independent Test**: spec.md User Story 2's own Independent Test.

**Depends on**: User Story 1 (edits the same relocated block; sequenced after it in the same file, not parallel).

### Tests for User Story 2 ⚠️

> Write first; confirm they fail before implementing.

- [ ] T005 [US2] In `e2e/us-ncr-next-action-visibility.spec.js`, add `test.describe('US2 — button permission-gated')` with four tests, each creating its own NCR via `createNcrInStatus` (T002's helper):
  1. **Submitted**, ce_cs `dong`: as `dong`, the detail page shows "Create Disposition"; as `bob`, it shows no action button at all (assert absence of all four button texts, or more simply that no `.btn` with an `href` to `/disposition`, `/concurrence`, `/approve`, or `/close` for this NCR exists).
  2. **Dispositioned**: as `dong` (QA staff), shows "QA Concurrence". Then `remove-group-member` for `bob` from `ncr-qa` (guarding with a `try/finally` that always `add-group-member`s it back, per that fixture's existing precedent in `us3-qa-concurrence-and-approver-coordination.spec.js`), and as `bob`, confirm no action button.
  3. **Approval Requested**, `additional_approvers: [{ approver_id: 'bob', approval_status: 'Pending' }]`: as `bob`, shows "Approve / Return"; as `dong` (not a designated approver on this NCR), shows no action button.
  4. **Final Approval**, originator `dong`: as `dong`, shows "Close NCR"; as `bob` (neither Originator nor Designate on this NCR), shows no action button.
- [ ] T006 [P] [US2] In the same file, add one more test confirming FR-002/the "no regression for no-action statuses" edge case: an NCR in `Returned for Comment` (or `Closed`) status shows no action button for `dong` even though `dong` is QA staff / would otherwise qualify for some other status's button.

### Implementation for User Story 2

- [ ] T007 [US2] In `views/ncr-detail-body.jade`, add the four `can*` boolean declarations immediately after the existing `canManageApprovers` declaration (line 1), exactly as specified in data-model.md: `canCreateDisposition = ncr.status === 'Submitted' && ncr.ce_cs_id === locals.userid`; `canConcur = ncr.status === 'Dispositioned' && isQa`; `canApprove = ncr.status === 'Approval Requested' && ncr.additional_approvers.some(a => a.approver_id === locals.userid)`; `canClose = ncr.status === 'Final Approval' && (locals.userid === ncr.originator_id || locals.userid === ncr.originator_designate_id)`.
- [ ] T008 [US2] In the relocated button block (T004), replace each `if ncr.status === '...'` with its matching `can*` boolean (`if canCreateDisposition`, `if canConcur`, `if canApprove`, `if canClose`), and wrap the whole `.row-fluid` in `if canCreateDisposition || canConcur || canApprove || canClose` so the row itself isn't emitted (no stray empty space) when nobody is authorized for the current status's action. (makes T005/T006 pass)

**Checkpoint**: Both user stories are functional and independently testable — the button is both repositioned and shown only to whoever can actually use it.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Verification and the checks the constitution requires.

- [ ] T009 Run `npx eslint .` and confirm no new errors (this feature touches no `.js` file other than the new e2e spec).
- [ ] T010 With the stack running, run the full e2e suite `npm run e2e` and confirm `e2e/us-ncr-next-action-visibility.spec.js` passes and no other spec regressed — in particular `e2e/us3-qa-concurrence-and-approver-coordination.spec.js` and `e2e/us-originator-designate.spec.js`, which both exercise the NCR detail page this feature changes.
- [ ] T011 Walk through `specs/128-ncr-action-button-visibility/quickstart.md` section 1 manually against the running stack.
- [ ] T012 Add a `CLAUDE.md` "Recent Changes" entry for `128-ncr-action-button-visibility`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **User Story 1 (Phase 2)**: needs Setup only.
- **User Story 2 (Phase 3)**: needs User Story 1 — both edit the same relocated block in the same file; US2's tasks assume T003/T004 already landed.
- **Polish (Phase 4)**: after both stories.

### Shared-file ordering

| File | Order |
|---|---|
| `views/ncr-detail-body.jade` | T003 → T004 → T007 → T008 |
| `e2e/us-ncr-next-action-visibility.spec.js` | T002 → T005 → T006 |

Single-file feature — there is no real parallelism across implementation tasks; T006 is the only task with no ordering dependency on another same-file task beyond file creation (T002).

### Parallel Opportunities

None beyond T006, which can be written alongside T005 once T002 has created the file (both are additions to the same new file, in different, non-overlapping `describe`/`it` blocks).

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup).
2. Phase 2 (User Story 1) — the button moves. **Ship alone as the MVP** if desired, though in practice both stories are small enough to ship together.
3. **Stop and validate** against quickstart.md section 1, step 1, before continuing.

### Incremental Delivery

1. Setup → foundation ready.
2. US1 (P1) → test → demo — button repositioned.
3. US2 (P2) → test → demo — button permission-gated.
4. Polish (Phase 4) — lint, full e2e, quickstart walk-through, changelog.

### Notes

- Confirm each story's tests fail before implementing it.
- Commit after each phase; stop at the Phase 2 checkpoint to validate that story independently if desired.
