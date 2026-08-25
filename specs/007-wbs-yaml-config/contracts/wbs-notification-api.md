# Contract: WBS Notification API (Revised)

**Feature**: 007-wbs-yaml-config
**Date**: 2026-08-24
**Updated**: 2026-08-24 (post-clarification: admin page WBS management removed)

This document describes the **revised** WBS Notification API. The POST/PATCH/DELETE management endpoints are **removed**. Only the GET endpoint is retained, now returning YAML-loaded entries exclusively.

---

## Retained Endpoint

### GET /wbs-notifications/

Returns all active WBS notification mappings currently loaded from `wbs.yaml`.

**Auth**: Session-authenticated admin only (unchanged).

**Response** (200 OK):

```json
{
  "success": true,
  "entries": [
    {
      "wbs_number": "1.2",
      "notification_email": "team-lead@example.com",
      "source": "config"
    },
    {
      "wbs_number": "3.1.4",
      "notification_email": "qa-group@example.com",
      "source": "config"
    }
  ]
}
```

**Behaviour change**: Previously returned a mix of DB-entered and YAML entries. Now returns only YAML-loaded entries (all with `source: "config"`). Returns an empty `entries` array when no `wbs.yaml` is present or when no valid entries were loaded.

**Sorting**: Entries are sorted by `wbs_number` ascending.

---

## Removed Endpoints

The following endpoints are **deleted**. Any client still sending requests to them will receive a 404 response (route no longer registered).

| Method | Path | Previously did |
|--------|------|----------------|
| POST | `/wbs-notifications/` | Create a new DB-backed WBS mapping |
| PATCH | `/wbs-notifications/:wbsNumber` | Update the email for a DB-backed mapping |
| DELETE | `/wbs-notifications/:wbsNumber` | Remove a DB-backed mapping |

---

## wbs.yaml File Contract

```
File: <configDir>/wbs.yaml
Format: YAML key-value pairs
Encoding: UTF-8
Optional: yes (file absence = no entries loaded, empty array returned by GET)
```

### Valid entry format

```yaml
<wbs_number>: <email>
```

- `<wbs_number>`: dot-notation string matching `/^[^.]+(\.[^.]+)*$/` (e.g., `1.2`, `WBS-A.2.3`). Keys that look like numbers (e.g., `1.2`) are treated as strings.
- `<email>`: valid email address matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

### Invalid entry handling

- Malformed YAML (file level): entire file is rejected; error logged at startup; zero entries loaded; GET returns `[]`.
- Invalid `wbs_number` format (entry level): entry skipped; warning logged; other entries continue loading.
- Invalid `email` format (entry level): entry skipped; warning logged; other entries continue loading.

### Example

```yaml
# WBS-to-email notification registry (loaded at startup, optional)
1.2: team-lead@example.com
3.1.4: qa-group@example.com
WBS-INFRA.1: infra-alerts@example.com
```
