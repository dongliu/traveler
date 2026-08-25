# Quickstart Validation Guide: WBS YAML Config File

**Feature**: 007-wbs-yaml-config
**Date**: 2026-08-24
**Updated**: 2026-08-24 (post-clarification: admin page management removed)

This guide describes how to validate the feature end-to-end after implementation.

---

## Prerequisites

- Docker Compose environment running (`docker compose up`)
- Admin user credentials available
- `curl` or a REST client for API calls

---

## Scenario 1: Valid wbs.yaml is loaded at startup

**Setup**:

1. Create `docker/wbs.yaml` with the following content:
   ```yaml
   1.2: yaml-team@example.com
   3.1: yaml-qa@example.com
   ```

2. Restart the application: `docker compose restart web`

3. Check startup logs for a confirmation message, e.g.:
   ```
   [wbs-yaml] Loaded 2 WBS notification mapping(s) from wbs.yaml
   ```

**Validation**:

```bash
# List all entries — should include YAML-sourced entries with source: "config"
curl -s -u admin:password http://localhost:3001/wbs-notifications/ | jq '.entries'
```

Expected: entries for `1.2` and `3.1` with `"source": "config"`.

---

## Scenario 2: Application starts normally with no wbs.yaml

**Setup**:

1. Ensure `docker/wbs.yaml` does not exist (remove if present).
2. Restart the application.

**Validation**:

- Application starts without errors related to `wbs.yaml`.
- GET `/wbs-notifications/` returns `{ "success": true, "entries": [] }`.
- WBS notification resolution for any NCR returns no match (no email sent).

---

## Scenario 3: WBS resolution uses YAML mapping

**Setup**:

1. Add `docker/wbs.yaml` with:
   ```yaml
   1.1: yaml-wins@example.com
   ```
2. Restart the application.

**Validation**:

- Trigger an NCR with WBS number `1.1` and verify the notification email resolves to `yaml-wins@example.com` (check email logs or Mailpit).

---

## Scenario 4: Invalid wbs.yaml is reported clearly

**Setup**:

1. Create `docker/wbs.yaml` with invalid YAML:
   ```
   1.2: good@example.com
   this is: not: valid: yaml:
   ```

2. Restart the application.

**Validation**:

- Application starts successfully.
- Startup logs contain an error message identifying the YAML parse failure and the file path.
- GET `/wbs-notifications/` returns `{ "success": true, "entries": [] }` (no partial entries).

---

## Scenario 5: Individual invalid entry is skipped, valid entries load

**Setup**:

1. Create `docker/wbs.yaml` with a mix:
   ```yaml
   2.1: valid@example.com
   2.2: not-an-email
   2.3: also-valid@example.com
   ```

2. Restart the application.

**Validation**:

- Startup logs show a warning for `2.2` (invalid email) and confirm 2 mappings loaded.
- GET `/wbs-notifications/` returns entries for `2.1` and `2.3` only.

---

## Scenario 6: Admin page shows YAML entries as read-only (no management controls)

**Setup**: Same as Scenario 1 (valid wbs.yaml with entries).

**Validation**:

1. Open the WBS Notifications admin page in a browser.
2. YAML-loaded entries are displayed (read-only).
3. **No** Add, Edit, or Delete controls are present anywhere on the page.
4. Confirm that POST/PATCH/DELETE requests to `/wbs-notifications/` return 404 (routes removed).

```bash
# Should return 404
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/wbs-notifications/ \
  -u admin:password -H "Content-Type: application/json" \
  -d '{"wbs_number":"9.9","notification_email":"test@example.com"}'
```

Expected: `404`

---

## Scenario 7: Hierarchical WBS resolution uses YAML ancestry

**Setup**:

1. Create `docker/wbs.yaml` with:
   ```yaml
   1: parent@example.com
   ```
2. Restart.

**Validation**:

- Trigger an NCR with WBS number `1.2.3`.
- Notification resolves to `parent@example.com` (ancestor `1` matches).

---

## Unit Test Validation

Run the unit test suite to verify the YAML loader and updated service logic:

```bash
TRAVELER_CONFIG_REL_PATH=docker npm test
```

Expected: all tests pass, including new tests for:
- `lib/wbs-yaml-loader.js` — loading valid file, missing file, invalid YAML, per-entry validation
- `lib/wbs-notification-service.js` — `resolveWbsContact` uses YAML map only; `listEntries` returns YAML entries only

See [data-model.md](data-model.md) for entity details and [contracts/wbs-notification-api.md](contracts/wbs-notification-api.md) for API response shapes.
