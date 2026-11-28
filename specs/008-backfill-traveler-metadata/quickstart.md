# Quickstart Validation Guide: Backfill Traveler Classification Metadata

Use this guide to verify the feature works end-to-end after implementation. Each scenario maps to a user story from [spec.md](spec.md).

## Prerequisites

- Application running locally (`node app.js` or `npx nodemon`)
- A released form you own (or admin credentials), with at least one traveler already created from it
- MongoDB accessible, so traveler documents can be inspected directly if needed

---

## Scenario 1 — Blank Fields Get Backfilled (User Story 1 / FR-001, FR-002)

**Goal**: Verify that correcting a released form's classification fills in a traveler that was created before those fields existed.

1. Find (or create) a released form with a blank Activity.
2. Create a traveler from it. **Expected**: the new traveler's Activity is blank (inherited blank).
3. As the owner or an admin, open the released form's detail page and set Activity to `"Inspection"`. Save.
4. **Expected**: the save succeeds and the released form's detail page now shows Activity = `"Inspection"`.
5. Open the traveler created in step 2.
6. **Expected**: the traveler's Activity now shows `"Inspection"` — with no manual edit on the traveler.

**Repeat** with a released form that has several travelers, each missing a different subset of Subsystem/Device/Activity, updating all three fields at once:
- **Expected**: each traveler ends up with only its previously-blank fields filled in.

---

## Scenario 2 — Existing Values Are Never Overwritten (User Story 2 / FR-003)

**Goal**: Verify the backfill never clobbers a value a user already has.

1. Open a traveler created from a released form, and set its Subsystem to `"Manual Override"` (via the traveler's existing edit control from spec 003).
2. As the owner or admin, change the released form's Subsystem to a different value, e.g. `"Vacuum"`. Save.
3. Reopen the traveler from step 1.
4. **Expected**: the traveler's Subsystem is still `"Manual Override"` — unchanged.

---

## Scenario 3 — Out-of-Scope Travelers Are Untouched (User Story 2 / FR-004)

**Goal**: Verify an update to one released form never reaches travelers tied to a different released form or version.

1. Create two released forms (or release the same form title twice, producing two different versions), each with its own traveler, both travelers having a blank Device.
2. Update only the first released form's Device to `"Turbo Pump"`.
3. Reopen the traveler created from the **second** released form.
4. **Expected**: its Device is still blank — unaffected by the first released form's update.

---

## Scenario 4 — Applies Regardless of Traveler Lifecycle State (Edge Case / FR-005)

**Goal**: Verify the backfill reaches travelers even when a normal user-initiated edit to those fields would be blocked.

1. Take a traveler with a blank Subsystem through to an approved or frozen state.
2. As the owner or admin, set the released form's Subsystem to a new value. Save.
3. Reopen the approved/frozen traveler.
4. **Expected**: its Subsystem is now filled in, even though a direct user edit to that field would normally be blocked at this lifecycle state for a non-admin.

---

## Scenario 5 — No-Op Cases (Edge Cases)

1. Update a released form's metadata to the exact values it already had (no actual change). **Expected**: save succeeds; no linked traveler's values change (they already matched, or were already blank-and-filled from a prior update).
2. Update a released form that has no travelers created from it yet. **Expected**: save succeeds normally, no errors.
3. Clear a released form field back to blank (e.g., set Device from `"Turbo Pump"` back to `""`). **Expected**: save succeeds; no traveler is updated for that field (there is nothing non-blank to propagate).

---

## Automated Test Touchpoints (for `test/lib/`)

After implementing, add tests covering the new `lib/traveler-metadata.js` function directly (no HTTP layer needed for most cases):

- Given a released form and a traveler with all three fields blank, backfill sets all three to the released form's values.
- Given a traveler with one non-blank field and two blank fields, backfill only changes the two blank fields.
- Given a traveler with all three fields already non-blank, backfill makes no changes and does not call `.save()`.
- Given a traveler referencing a different `referenceReleasedFormVer`, it is excluded from the match.
- Given a released form field that is itself blank, no traveler is updated for that field even if the traveler's field is also blank.

Also extend/verify the existing smoke coverage for `PUT /released-forms/:id/metadata` to confirm the response shape is unchanged.

Run with: `npx mocha test/lib/`

---

## Validation Checklist

- [ ] Scenario 1 (single traveler, single field) passes
- [ ] Scenario 1 (multiple travelers, multiple fields, independent backfill) passes
- [ ] Scenario 2 (existing traveler value preserved) passes
- [ ] Scenario 3 (other released form/version untouched) passes
- [ ] Scenario 4 (approved/frozen traveler still backfilled) passes
- [ ] Scenario 5a (identical resubmission, idempotent) passes
- [ ] Scenario 5b (released form with no travelers) passes
- [ ] Scenario 5c (clearing a field propagates nothing) passes
