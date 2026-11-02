# Contract: Public Travelers API (`/apis/publictravelers/`, `/publictravelers/list`)

This is the one surface in scope for this feature with a formally published, versioned-feeling contract (`views/docs/api/public-travelers.md`) consumed by parties outside this app's own browser UI, and the only one with a deliberate JSON-vs-CSV divergence (see research.md, Decision 2). This document specifies the wire-format change; `views/docs/api/public-travelers.md` itself is updated as an implementation task, not here.

## JSON response — additive only

Every field documented today (`_id`, `title`, `status`, `statusCode`, `createdBy`, `createdOn`, `updatedBy`, `updatedOn`, `archivedOn`, `owner`, `tags`, `totalInput`, `finishedInput`, `subsystem`, `device`, `activity`, `machineArea`, `sector`, `windchillId`) keeps exactly its current meaning, type, and presence guarantee ("every property is always present"). No existing consumer needs to change.

Three new fields are added, each following the "value when resolvable / fallback" rule from data-model.md:

| New field | Resolved from | Always present? |
|---|---|---|
| `createdByName` | `createdBy` | Yes — equals `createdBy` itself if the account has no resolvable name |
| `updatedByName` | `updatedBy` | Yes — same fallback rule |
| `ownerName` | `owner` | Yes — same fallback rule |

### Before (current, documented)

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "title": "Cryomodule leak check",
  "status": "active",
  "statusCode": 1,
  "createdBy": "liud",
  "createdOn": "2026-08-30T14:02:11.000Z",
  "updatedBy": "smith",
  "updatedOn": "2026-09-14T09:41:03.000Z",
  "archivedOn": null,
  "owner": "liud",
  "tags": ["leak-check", "vacuum"],
  "totalInput": 36,
  "finishedInput": 12,
  "subsystem": "Cryogenics",
  "device": "CM-02",
  "activity": "Acceptance test",
  "machineArea": "Linac tunnel",
  "sector": "S4",
  "windchillId": "WC-0012345"
}
```

### After (this feature)

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "title": "Cryomodule leak check",
  "status": "active",
  "statusCode": 1,
  "createdBy": "liud",
  "createdByName": "Dong Liu",
  "createdOn": "2026-08-30T14:02:11.000Z",
  "updatedBy": "smith",
  "updatedByName": "John Smith",
  "updatedOn": "2026-09-14T09:41:03.000Z",
  "archivedOn": null,
  "owner": "liud",
  "ownerName": "Dong Liu",
  "tags": ["leak-check", "vacuum"],
  "totalInput": 36,
  "finishedInput": 12,
  "subsystem": "Cryogenics",
  "device": "CM-02",
  "activity": "Acceptance test",
  "machineArea": "Linac tunnel",
  "sector": "S4",
  "windchillId": "WC-0012345"
}
```

If `liud`'s account has no `name` on file, `createdByName` and `ownerName` are `"liud"` — identical to the existing field, never blank or omitted.

## CSV export — the one intentional substitution

Column order and header row are unchanged: `_id, title, status, createdBy, createdOn, updatedBy, updatedOn, archivedOn, owner, tags, totalInput, finishedInput, subsystem, device, activity, machineArea, sector, windchillId`.

The **values** under the `createdBy` and `updatedBy` columns change from the account identifier to the resolved full name (same fallback: the identifier itself when no name is on file). `owner`'s CSV column is unchanged — only `createdBy`/`updatedBy` were named in the clarification. Every other column, and all other CSV formatting rules (RFC 4180 escaping, formula-injection neutralization, UTF-8 BOM, no trailing newline), are unchanged.

### Before

```text
_id,title,status,createdBy,createdOn,updatedBy,updatedOn,archivedOn,owner,...
64f1a2b3c4d5e6f7a8b9c0d1,Cryomodule leak check,active,liud,2026-08-30T14:02:11.000Z,smith,2026-09-14T09:41:03.000Z,,liud,...
```

### After

```text
_id,title,status,createdBy,createdOn,updatedBy,updatedOn,archivedOn,owner,...
64f1a2b3c4d5e6f7a8b9c0d1,Cryomodule leak check,active,Dong Liu,2026-08-30T14:02:11.000Z,John Smith,2026-09-14T09:41:03.000Z,,liud,...
```

## Backward compatibility statement

- Any script or tool parsing the JSON `createdBy`/`updatedBy`/`owner`/`status`/... fields by name is unaffected: types and values are identical to today.
- Any script or tool parsing the **CSV** `createdBy`/`updatedBy` columns as a stable login/account key will see a behavior change (full name instead of id) — this is the one deliberate, clarified exception (FR-008). A consumer that needs the stable identifier from this endpoint should use the JSON form instead, where `createdBy`/`updatedBy` are untouched.
