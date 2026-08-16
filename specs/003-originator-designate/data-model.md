# Phase 1 Data Model: NCR Originator Designate Assignment

**Feature**: `003-originator-designate` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature adds fields to the existing `Ncr` document (`model/ncr.js`) —
it introduces no new collection or top-level entity, consistent with
research.md Decision 1.

## `Ncr` schema additions

| Field | Type | Notes |
|---|---|---|
| `originator_designate_id` | `String` | The current Designate's user id, or absent/unset when no Designate is assigned. Mirrors `ce_cs_delegate_id`'s existing shape exactly (research.md Decision 1). |
| `originator_designate_name` | `String` | Cached display name for the Designate, populated at assignment time — mirrors the existing `ce_cs_name`/`ce_cs_id` caching pair, so `views/ncr-detail.jade` can render the current Designate without a User lookup/populate at render time, consistent with how the page already renders `ncr.ce_cs_name`/`ncr.originator_name` directly from the lean document. |

Both fields are optional (no `required: true`) — an NCR with no Designate
simply has neither field set, which is the default state for every existing
NCR in the database today (this is a purely additive schema change; no
migration is needed).

## `NCR_EVENT_TYPES` additions

| Value | Status | Notes |
|---|---|---|
| `delegate.assigned` | Already present in the enum, previously unused | Reused for both initial assignment and replacement (research.md Decision 2) |
| `delegate.removed` | New | Added for removal, matching the schema's existing one-event-type-per-outcome convention |
| `notification.designate_assigned` | New | The system-side record of the FR-006 notification email send, via the existing `appendNotificationEvent()` helper — added because every other email send in `lib/ncr-service.js` (`notification.initial`, `notification.issuance`, `notification.pa_assigned`, etc.) gets its own tracked system event with per-recipient delivery status/timestamp, and the Designate notification should follow the same convention rather than being the one email in the codebase with no delivery tracking |

## Event payload shape

`delegate.assigned`/`delegate.removed` are `actor_type: 'user'` events (the
Originator performing the assignment/removal), following the same shape as
every other user-action event in `NcrEventSchema`:

- `actor_id`/`actor_name`: the acting Originator (always — per FR-002, only
  the Originator can ever produce this event)
- `actor_role`: `'originator'`
- `timestamp`: when the assignment/removal occurred
- `payload` (for `delegate.assigned`): `{ designate_id, designate_name }`
- `payload` (for `delegate.removed`): `{ previous_designate_id, previous_designate_name }`

`notification.designate_assigned` is an `actor_type: 'system'` event,
produced by `appendNotificationEvent()` exactly like every other
notification event in this schema — `recipients: [{recipient_email, delivery_status,
delivery_timestamp, error_message}]` for the Designate. No `cc` (this
notification has no CC recipient).

No `previous_status`/`new_status` — assigning or removing a Designate does
not transition the NCR's own workflow `status`.

## Permission and visibility check sites (research.md Decision 5)

Four existing sites in `lib/ncr-service.js`, each already keying off
`ncr.originator_id`, each getting a parallel `ncr.originator_designate_id`
check:

| Site | Current behavior | Change |
|---|---|---|
| `closeNcr()` permission check | `ncr.originator_id !== user.id` → 403 | `ncr.originator_id !== user.id && ncr.originator_designate_id !== user.id` → 403 |
| `submitConcurrence()`/`submitApproval()` issuance recipients | `findUsers([ncr.originator_id])` | Include `ncr.originator_designate_id` (if set) in the id list passed to `findUsers()` |
| `closeNcr()` final-distribution recipients | `recipientIds.add(ncr.originator_id)` | Also `recipientIds.add(ncr.originator_designate_id)` (if set) |
| `buildRoleScope()` (dashboard scope) + `getNcrById()` (manual scope re-check on a `.lean()` doc) | `{ originator_id: user.id }` clause | Add a parallel `{ originator_designate_id: user.id }` clause in both places |

## New service functions

Two new functions in `lib/ncr-service.js`, following the file's established
per-action-function convention (one function per state-changing operation,
matching e.g. `assignPaOwner`):

- **`assignDesignate(ncrId, designateData, user)`**: verifies
  `ncr.originator_id === user.id` (FR-002), verifies
  `designateData.designate_id !== user.id` (FR-003), verifies the NCR is not
  `'Closed'` (FR-005), sets `originator_designate_id`/`originator_designate_name`
  (overwriting any prior value — this same function handles both first
  assignment and replacement, since both are the same operation), appends a
  `delegate.assigned` event, sends the Designate a notification email
  (FR-006), saves.
- **`removeDesignate(ncrId, user)`**: same Originator-only and
  not-`'Closed'` checks, clears both fields, appends a `delegate.removed`
  event (capturing the outgoing Designate's id/name in the payload before
  clearing), saves.

## Relationships

```
Ncr.originator_id ──(always)──> User (the Originator)
Ncr.originator_designate_id ──(0 or 1)──> User (the current Designate, if assigned)
Ncr.events[] ──(delegate.assigned / delegate.removed)──> records every assignment/removal, actor = the Originator
```

An `Ncr` has at most one active Designate at a time (FR-001: "exactly one
other user"); assigning a new one replaces rather than adds to the existing
value, since the field is a single id, not an array.
