# Released form and traveler metadata

This document covers the classification and instance metadata fields available on released
forms and travelers: what each field means, where it's set and edited, and how it flows from a
released form into the travelers created from it.

---

## Overview

Two groups of fields exist:

- **Classification fields** — `Subsystem`, `Device`, `Activity`. These originate on the
  **released form** and are copied onto a traveler when the traveler is created. Once copied,
  each field lives independently on the traveler: editing it on the traveler never changes the
  source released form, and editing the released form never changes travelers already created
  from it.
- **Instance fields** — `Machine Area`, `Sector`, `Product Windchill ID`. These exist only on the
  **traveler**. There is nothing to inherit; they capture deployment context specific to that one
  work instance (where the work happens, and what product it applies to).

All six fields are optional, free-text strings. There is no controlled vocabulary — users are
responsible for entering consistent values.

---

## Released form: Subsystem, Device, Activity

### Setting them at release time

When releasing a draft form (the **Release** action on the form builder page), the release
dialog now asks for `Subsystem`, `Device`, and `Activity` alongside the form title. All three are
optional — releasing with them blank is allowed, and the resulting released form simply has empty
values for whichever fields were skipped.

### Editing them after release

On the released form's detail page (`/released-forms/<id>/`), the **owner** (the user who
released the form) and any **admin** see the three fields as an inline edit form with a **Save**
button. Anyone else sees them as plain read-only text.

Saving goes through `PUT /released-forms/<id>/metadata`. This updates only `subsystem`, `device`,
and `activity` — it does not touch the form's `released` status, its content, or trigger a new
review cycle. The change is recorded in the form's audit history like any other tracked field.

### Where else they appear

The released forms list table (the **Released** tab on the form management page) has `Subsystem`,
`Device`, and `Activity` columns, so classification is visible without opening each form.

---

## Traveler: inherited and instance fields

### Inheriting from the released form

When a traveler is created from a released form, the traveler's `subsystem`, `device`, and
`activity` are set from the released form's current values at that moment. If the released form
had blank classification fields, the new traveler's fields start blank too — there's no error or
placeholder text.

Because this is a one-time copy at creation, later edits to the released form's classification
(via the flow above) have no effect on travelers already created from it.

### Editing on the traveler

All six fields — the three inherited ones plus the three instance fields — are edited on the
traveler's **Configuration** page (`/travelers/<id>/config`, the **Configuration** button on the
traveler detail page), using the same inline-edit-and-save pattern as the traveler's Title and
Description.

**Who can edit, and when:**

| Traveler state | Owner | Admin |
|---|---|---|
| Not started (0), in progress (1), submitted for review (1.5) | Can edit | Can edit |
| Approved (2), frozen (3) | Cannot edit | Can edit |
| Archived | Cannot edit | Cannot edit |

An archived traveler blocks metadata edits outright, regardless of role — archiving is enforced
before the admin check ever runs. For a non-archived traveler, the state restriction is lifted
entirely for admins; a non-admin owner is limited to the three active states.

### Where they appear

- **Traveler detail page**: all six fields are shown at the top, next to the other always-visible
  metadata (form version, etc.) — not tucked inside the collapsible "Details" section.
- **Configuration page**: same six fields, editable per the rules above.

---

## The `Device` field and the legacy `devices` list

Travelers previously tracked a `devices` array — a list of physical equipment/inventory
identifiers, originally intended for device-application (CCDB) integration. That concept has been
folded into the single `device` classification field described above.

**Display fallback**: wherever a traveler's device is shown (the traveler detail page, the
configuration page, and every traveler list table's `Device` column), the displayed value is:

```
device || devices.join('/')
```

That is, the new `device` string is used if it has a value; otherwise the display falls back to
the old `devices` array, joined with `/`, for travelers created before this change.

**Editing**: the traveler configuration page now edits only `device` — a single text field. The
old per-device add/edit/remove list UI (including the CCDB device-inventory typeahead) has been
removed from that page. Saving `device` writes directly to the `device` field; it never writes to
`devices`. Going forward, `devices` is not populated for new travelers — it exists only for
backward-compatible display of older data.

---

## Data model reference

| Entity | Field | Type | Set by |
|---|---|---|---|
| Released form | `subsystem` | String | User, at release or via post-release edit |
| Released form | `device` | String | User, at release or via post-release edit |
| Released form | `activity` | String | User, at release or via post-release edit |
| Traveler | `subsystem` | String | Copied from released form at creation; editable after |
| Traveler | `device` | String | Copied from released form at creation; editable after |
| Traveler | `activity` | String | Copied from released form at creation; editable after |
| Traveler | `machineArea` | String | User, on the traveler only |
| Traveler | `sector` | String | User, on the traveler only |
| Traveler | `windchillId` | String | User, on the traveler only |

All fields default to an empty string, so existing released forms and travelers created before
this feature remain valid with no migration step.
