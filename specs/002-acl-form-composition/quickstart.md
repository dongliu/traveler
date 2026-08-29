# Quickstart: Validate ACL Form Composition

Manual end-to-end validation steps (the repository has no route/UI test harness — see `plan.md`
Technical Context, "Testing"). Run against a local dev server.

## Prerequisites

```bash
npx nodemon   # or: node app.js
```

Log in as a user with the `manager` or `admin` role (compose is Manager/Admin-only per FR-013 and
`research.md`'s permission decision).

## 1. Author and release two standalone ACL forms

1. Create a new form, set its type to **ACL** (same "New form" flow used for `normal`/`discrepancy`
   today), give it a simple body with one uniquely-named input, e.g. `acl_field_a`.
2. Submit for review, approve, release it. Note its released form id — call it `A1`.
3. Repeat to produce a second released ACL form with a different unique input name, e.g.
   `acl_field_b` — call it `A2`.

**Expected**: Both appear in `GET /released-forms/acl/json` with `status: 1`.

## 2. Author and release a base form

1. Create a new `normal` form with one uniquely-named input, e.g. `base_field`.
2. Submit for review, approve, release it (no discrepancy attached) — call it `B1`.

**Expected**: `B1` appears in `GET /released-forms/normal/json`.

## 3. Compose base + ACL forms (User Story 1)

1. From `B1`'s released-form detail page, use the new "Compose" entry point.
2. Select `A1` and `A2` in the ACL picker, confirm.

**Expected**: `201` response; the new composed released form's detail page shows `base_field` (from
`B1`), and lists `A1` and `A2` with their titles/versions (User Story 4).

## 4. Base-only composition is valid (FR-007)

1. From `B1`, compose again selecting **no** ACL forms.

**Expected**: `201`; the resulting released form references only the base, no `aclForms` entries.

## 5. Duplicate detection (User Story 3)

1. Repeat step 3 exactly (same `B1` + `{A1, A2}`).

**Expected**: `400`, "already released" — blocked as a duplicate.

2. Repeat step 3 but select `A2` then `A1` (reversed order).

**Expected**: still `400` — order does not change the outcome.

3. Compose `B1` + `{A1}` only (a genuinely different set).

**Expected**: `201` — succeeds, not treated as a duplicate of step 3's `{A1, A2}` composition.

## 6. Self-reference and duplicate-selection rejection (Edge Cases)

1. Attempt to compose `B1` with `B1` itself listed among `aclFormIds` (if reachable via direct
   request).

**Expected**: `400`.

2. Attempt to compose `B1` with `[A1, A1]` (same id twice).

**Expected**: `400`, or silently de-duplicated to a single `A1` attachment — per FR-005, either
outcome is acceptable as long as `A1` is never attached twice.

## 7. Input-name collision rejection

1. Create and release a third ACL form, `A3`, whose input is also named `base_field` (colliding
   with `B1`'s own input name).
2. Attempt to compose `B1` + `{A3}`.

**Expected**: `400`, naming the colliding input name (`research.md` §5).

## 8. Traveler rendering and data capture (User Story 2)

1. Create a traveler from the composed released form produced in step 3 (`B1` + `{A1, A2}`).
2. Open the traveler.

**Expected**: The page shows `A1`'s and `A2`'s input sections at the top, above the `base_field`
section, each clearly labeled with the ACL form's identity.

3. Enter a value into `acl_field_a`, save.

**Expected**: `POST /travelers/:id/data/` succeeds (`204`); `GET /travelers/:id/data/` includes the
saved `acl_field_a` value; the traveler's progress indicator counts it toward `finishedInput` (not
just base fields) — confirms `research.md` §6's merged progress accounting.

4. Create a second traveler from the **base-only** composition produced in step 4.

**Expected**: No ACL section is rendered; the traveler behaves exactly as a plain base-only traveler
does today (FR-011).

## 9. Regression check — existing discrepancy path untouched

1. Release a fresh `normal` form the standard way, attaching a released `discrepancy` form as today.

**Expected**: Behaves exactly as before this feature — `normal_discrepancy` formType, `ver =
"<base_v>:<discrepancy_v>"`, discrepancy log popup on the resulting traveler. Confirms the compose
path and the discrepancy-attachment path remain fully independent (FR-003).
