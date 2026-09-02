# Data Model: WBS YAML Config File

**Feature**: 007-wbs-yaml-config
**Date**: 2026-08-24
**Updated**: 2026-08-24 (post-clarification: admin page removed; WbsNotification DB model removed)

## Entities

### WbsYamlEntry (in-memory, not persisted)

Represents a single WBS-to-email mapping loaded from `wbs.yaml` at application startup. This is the **sole** runtime source for WBS notification mappings.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `wbs_number` | String | Required, non-empty, dot-notation segments (`/^[^.]+(\.[^.]+)*$/`) | Preserved exactly as written in YAML (FAILSAFE_SCHEMA) |
| `notification_email` | String | Required, valid email syntax (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) | |
| `source` | `'config'` literal | Always `'config'` | Identifies origin for any display purposes |

**Lifecycle**: Loaded once synchronously at application startup from `wbs.yaml`. Held in memory on `config.wbsYaml` as a plain `{ [wbs_number]: notification_email }` object. Discarded when the process exits. Re-read on next startup.

---

### WbsNotification Mongoose Model — REMOVED

The `WbsNotification` Mongoose model (`model/wbs-notification.js`) and the `wbs_notifications` MongoDB collection are **no longer used at runtime**. The model file is deleted as part of this feature. The MongoDB collection is left in existing databases and is not touched by the application — it is an administrator's responsibility to perform any desired data cleanup or migration before deploying.

---

## Config Module Extension

`config.wbsYaml` is added as an export on the existing `config` module:

```
config.wbsYaml: { [wbs_number: string]: string }
```

- Always present after `config.load()` runs.
- Empty object `{}` if `wbs.yaml` is absent, empty, or fatally invalid (after logging).
- Keys are WBS numbers (strings); values are email addresses (strings).

---

## wbs.yaml File Format

```yaml
# WBS number to email notification mapping
# One entry per line: <wbs_number>: <email>
1.2: team-lead@example.com
3.1.4: qa-group@example.com
```

**Location**:
- Standard deployment: `config/wbs.yaml`
- Docker deployment: `docker/wbs.yaml`

**Rules**:
- Each line is a YAML key-value pair.
- WBS number keys that look like numbers (e.g., `1.2`) are preserved as strings — enforced by `FAILSAFE_SCHEMA`.
- Duplicate keys: last definition wins (standard YAML behavior).
- Empty file: treated as zero mappings (not an error).
- Missing file: silently skipped (not an error), debug-level log emitted.

---

## State Transitions

```
Application startup
       │
       ▼
wbs.yaml present? ──No──► config.wbsYaml = {}  (debug log, no error)
       │
      Yes
       │
       ▼
Parse YAML ──FAIL──► log error, config.wbsYaml = {}  (fail-open)
       │
      OK
       │
       ▼
Validate each entry
  ├─ Valid ──► accumulate to in-memory map
  └─ Invalid ──► log per-entry warning, skip entry
       │
       ▼
config.wbsYaml = { wbs_number: email, ... }
log "[wbs-yaml] Loaded N mapping(s) from wbs.yaml"
       │
       ▼
Application ready
  resolveWbsContact → checks in-memory map ONLY (no DB query)
  listEntries       → returns in-memory entries ONLY
```

---

## Removed Entities / Cleanup

| Item | Action |
|------|--------|
| `model/wbs-notification.js` | Delete file |
| `wbs_notifications` MongoDB collection | Leave in existing databases (admin migrates data manually) |
| `require('./model/wbs-notification')` in `app.js` | Remove |
| `addEntry`, `updateEntry`, `removeEntry` in `lib/wbs-notification-service.js` | Remove |
| POST/PATCH/DELETE routes in `routes/wbs-notification.js` | Remove |
| Admin page WBS management UI (add/edit/delete controls) | Remove |
| `e2e/us-wbs-notification-registry.spec.js` | Update or replace |
| `e2e/us-wbs-hierarchical-notification-lookup.spec.js` | Update or replace |
