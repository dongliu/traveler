# Quickstart Validation Guide: Form & Traveler Metadata Fields

Use this guide to verify the feature works end-to-end after implementation. Each scenario maps to a user story from [spec.md](spec.md).

## Prerequisites

- Application running locally (`node app.js` or `npx nodemon`)
- A user account with owner privileges on at least one draft form
- Admin credentials available for admin-only scenarios
- MongoDB accessible

---

## Scenario 1 — Provide Metadata When Releasing a Form (FR-001, FR-002, FR-003)

**Goal**: Verify that the release modal accepts and persists Subsystem, Device, and Activity.

1. Log in as a form owner.
2. Navigate to a form in draft state.
3. Click the release button.
4. **Expected**: The release dialog now includes input fields for Subsystem, Device, and Activity.
5. Enter values: Subsystem = `"Cryogenics"`, Device = `"Magnet Assembly"`, Activity = `"Inspection"`.
6. Complete the release.
7. **Expected**: A new released form is created. Navigate to the released form detail page.
8. **Expected**: The detail page shows Subsystem = `"Cryogenics"`, Device = `"Magnet Assembly"`, Activity = `"Inspection"`.

**Repeat** with no values entered in the three fields:
- **Expected**: Release succeeds; all three fields display blank on the detail page.

---

## Scenario 2 — Edit Classification on an Already-Released Form (FR-004, FR-005)

**Goal**: Verify owner/admin can edit the three fields post-release; other users see them as read-only.

1. Navigate to a released form detail page as the form **owner**.
2. **Expected**: Subsystem, Device, Activity are editable (edit controls visible).
3. Change Subsystem to `"Vacuum"`, click Save.
4. **Expected**: The page reflects `"Vacuum"` immediately (or after reload). Form status remains `released`.
5. Log out and log in as a **non-owner, non-admin** user with read access to the same form.
6. **Expected**: Subsystem, Device, Activity are displayed as read-only text with no edit controls.

---

## Scenario 3 — Traveler Inherits Classification at Creation (FR-006, FR-007)

**Goal**: Verify the three form-level fields are copied to a new traveler automatically.

1. Navigate to a released form with Subsystem = `"Cryogenics"`, Device = `"Magnet Assembly"`, Activity = `"Inspection"`.
2. Create a new traveler from this form.
3. Navigate to the new traveler's detail page.
4. **Expected**: Subsystem = `"Cryogenics"`, Device = `"Magnet Assembly"`, Activity = `"Inspection"` appear on the traveler without any manual entry.
5. **Also expected**: Machine Area, Sector, and Product Windchill ID are blank.

**Repeat** with a released form that has blank classification fields:
- **Expected**: All three fields on the traveler are also blank (no error, no placeholder).

---

## Scenario 4 — Update Traveler Instance Metadata (FR-008, FR-009, FR-010)

**Goal**: Verify Machine Area, Sector, and Product Windchill ID are settable on active travelers; blocked on approved/frozen/archived for non-admins.

**4a — Active traveler (status: not started or in progress)**:

1. Navigate to a traveler in not-started or in-progress state.
2. **Expected**: Machine Area, Sector, and Product Windchill ID are editable.
3. Set Machine Area = `"Sector B"`, Sector = `"IR8"`, Windchill ID = `"WT-00123456"`, click Save.
4. **Expected**: Values persist and are displayed on the traveler detail page.

**4b — Submitted-for-review traveler (status 1.5)**:

1. Submit a traveler for review.
2. **Expected**: Machine Area, Sector, and Product Windchill ID are still editable.
3. Update one field and save.
4. **Expected**: Update succeeds.

**4c — Approved traveler (status 2), non-admin user**:

1. Navigate to an approved traveler as a non-admin user.
2. **Expected**: Machine Area, Sector, and Product Windchill ID are read-only (no edit controls).
3. Attempt a direct `PUT /travelers/:id/config` request with `{ "machineArea": "X" }` via curl or the browser DevTools.
4. **Expected**: Server responds `403 Forbidden` (or `400` if the status guard fires first).

**4d — Admin on any state**:

1. Log in as admin.
2. Navigate to an approved traveler.
3. **Expected**: Edit controls are visible.
4. Update a field and save.
5. **Expected**: Update succeeds.

---

## Automated Test Touchpoints (for `test/lib/`)

After implementing, add or extend tests in `test/lib/` (Mocha) covering:

- `createTraveler` copies `subsystem`, `device`, `activity` from the released form object.
- `createTraveler` leaves `machineArea`, `sector`, `windchillId` as `''`.
- `PUT /released-forms/:id/metadata` rejects non-owner non-admin callers.
- `PUT /travelers/:id/config` with `machineArea` rejects when traveler status is `2` (approved) for a non-admin caller.

Run with: `npx mocha test/lib/`

---

## Validation Checklist

- [ ] Scenario 1 (release with metadata) passes
- [ ] Scenario 1 (release without metadata, blank fields) passes
- [ ] Scenario 2 (owner edits post-release) passes
- [ ] Scenario 2 (non-owner sees read-only) passes
- [ ] Scenario 3 (traveler inherits values) passes
- [ ] Scenario 3 (traveler creation with blank form fields) passes
- [ ] Scenario 4a (update active traveler) passes
- [ ] Scenario 4b (update submitted-for-review traveler) passes
- [ ] Scenario 4c (non-admin blocked on approved traveler) passes
- [ ] Scenario 4d (admin can update approved traveler) passes
