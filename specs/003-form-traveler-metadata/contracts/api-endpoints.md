# API Contracts: Form & Traveler Metadata Fields

All endpoints are on the web-app server (session-authenticated). JSON body required where noted.

---

## 1. Release a Form (Modified)

**`POST /forms/:id/released`** *(existing endpoint, extended)*

Releases a draft form. Now accepts three additional optional body fields.

### Request Body Changes

```json
{
  "title":       "optional override",
  "description": "optional override",
  "subsystem":   "Cryogenics",
  "device":      "Magnet Assembly",
  "activity":    "Inspection"
}
```

All three new fields are optional strings. If omitted, they default to `''` on the created `ReleasedForm` document.

### Response (unchanged)

- `201 Created` — `{ "location": "<url of new released form>" }`
- `400 Bad Request` — duplicate title+type+version already released
- `500 Internal Server Error` — save failure

---

## 2. Update Released Form Classification (New)

**`PUT /released-forms/:id/metadata`**

Updates `subsystem`, `device`, and/or `activity` on an existing released form. Owner or admin only.

### Authorization

- `reqUtils.isOwnerOrAdminMw('id')` — same as the existing `/status` route

### Request Body

```json
{
  "subsystem": "Cryogenics",
  "device":    "Magnet Assembly",
  "activity":  "Inspection"
}
```

All fields are optional; only fields present in the body are updated (via `Object.assign` or equivalent). Unknown fields are stripped by `reqUtils.filter`.

### Response

- `200 OK` — `{ "subsystem": "...", "device": "...", "activity": "..." }` (echoes saved values)
- `403 Forbidden` — caller is not owner or admin
- `404 Not Found` — released form not found
- `500 Internal Server Error` — save failure

---

## 3. Update Traveler Instance Metadata (Extended)

**`PUT /travelers/:id/config`** *(existing endpoint, extended)*

Already handles `title`, `description`, `deadline`. Now also accepts three new instance-specific fields.

### Request Body Changes (additions)

```json
{
  "machineArea": "Sector B",
  "sector":      "IR8",
  "windchillId": "WT-00123456"
}
```

New fields may be included alongside existing fields or alone in a request. Unknown fields are stripped by `reqUtils.filter`.

### State Guard Change

The existing `reqUtils.status('id', [0, 1])` guard is updated to `reqUtils.status('id', [0, 1, 1.5])` to allow updates while the traveler is in the submitted-for-review state.

Admin callers bypass the state guard per the existing `isOwner || admin` check in the handler body.

### Response (unchanged)

- `200 OK` — JSON object echoing saved values for updated keys
- `403 Forbidden` — caller is neither owner nor admin
- `404 Not Found` — traveler not found
- `500 Internal Server Error` — save failure

---

## Field Propagation at Traveler Creation (Internal)

This is an internal behavior, not a separate endpoint. When `POST /travelers/` (or any path that invokes `routesUtilities.traveler.createTraveler`) creates a traveler from a released form, the response and resulting traveler document will include:

```json
{
  "subsystem": "<copied from released form>",
  "device":    "<copied from released form>",
  "activity":  "<copied from released form>",
  "machineArea": "",
  "sector":      "",
  "windchillId": ""
}
```

No change to the request schema for traveler creation.
