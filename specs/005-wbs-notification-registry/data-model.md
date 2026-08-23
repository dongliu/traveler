# Data Model: WBS Notification Registry

## Overview

One new MongoDB collection, `wbsnotifications`, holding a flat list of
WBS-number → notification-email entries. No relationship to the existing
`ncrs` collection is established by this feature (see spec.md "Out of
Scope") — the free-text `wbs_number` field on `Ncr` documents remains
independent.

## Entity: WbsNotification

**Purpose**: One registry entry — a WBS number and the single email address
that should eventually be notified for NCRs associated with it.

**Mongoose Schema** (`model/wbs-notification.js`):

```javascript
{
  wbs_number: {
    type: String,
    required: true,
    unique: true,       // case-sensitive exact match (FR-004)
    trim: true,          // leading/trailing whitespace stripped (edge case)
  },
  notification_email: {
    type: String,
    required: true,
    trim: true,
  },

  created_by: String,       // admin user id (FR-010)
  created_by_name: String,
  updated_by: String,
  updated_by_name: String,

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}
```

**Indexes**:
- `wbs_number` — unique index (enforces FR-004 at the database layer, in
  addition to the service-layer pre-check that produces a clean 409 error
  rather than surfacing a raw duplicate-key error to the client)

**Validation rules** (enforced in `lib/wbs-notification-service.js`, ahead of
any database write):

1. `wbs_number` — after trimming, MUST match `^[^.]+(\.[^.]+)*$` (one or more
   non-empty segments separated by single dots; see research.md Decision 4)
2. `wbs_number` — MUST NOT already exist in the collection (case-sensitive
   exact match) when adding a new entry
3. `notification_email` — after trimming, MUST match a pragmatic email-shape
   check (see research.md Decision 5)
4. On update, `wbs_number` in the URL/path MUST already exist — otherwise a
   404-equivalent "not found" error is raised, per FR-009
5. On remove, `wbs_number` in the URL/path MUST already exist — same 404
   handling as update

**State transitions**: None — this is a flat CRUD entity, not a workflow.

**Relationships**: None. Standalone collection; no foreign keys, no
references to `Ncr`, `User`, or any other existing model.

## Service Layer Functions (`lib/wbs-notification-service.js`)

```javascript
async function listEntries()                              // FR-001
async function addEntry(data, user)                        // FR-002–FR-005, FR-010
async function updateEntry(wbsNumber, data, user)           // FR-006, FR-009, FR-010
async function removeEntry(wbsNumber, user)                 // FR-007, FR-009
```

- `addEntry`/`updateEntry` both throw a typed error with `err.status` set
  (400 for validation failures, 409 for duplicate on add, 404 for "not
  found" on update/remove) — mirroring the `err.status`-driven error
  convention already used throughout `lib/ncr-service.js`.
- `user` parameter supplies `id`/`name` for the `created_by*`/`updated_by*`
  audit fields (FR-010), consistent with how `lib/ncr-service.js` records
  actor identity on every mutating call.

## REST Contract (`routes/wbs-notification.js`, mounted at
`/api/wbs-notifications`)

| Method | Path | Maps to | Success | Errors |
|--------|------|---------|---------|--------|
| GET | `/` | `listEntries()` | 200, `{ success: true, entries: [...] }` | 403 (non-admin) |
| POST | `/` | `addEntry()` | 201, `{ success: true, entry: {...} }` | 400 (format/email invalid), 403, 409 (duplicate) |
| PATCH | `/:wbsNumber` | `updateEntry()` | 200, `{ success: true, entry: {...} }` | 400, 403, 404 |
| DELETE | `/:wbsNumber` | `removeEntry()` | 200, `{ success: true }` | 403, 404 |

Every route: `auth.ensureAuthenticated, reqUtils.requireAdmin()` (see
research.md Decision 1). `:wbsNumber` is URL-encoded since WBS numbers
contain `.` characters (not a path-segment separator issue in Express, but
the client script encodes it defensively before building the request URL).
