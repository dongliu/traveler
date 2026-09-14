# Phase 1 Data Model: Admin NCR Deletion

**Feature**: `122-admin-delete-ncrs` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This feature introduces **no new collection and no schema change** to
`model/ncr.js` (research.md's Technical Context summary). It deletes existing
`Ncr` documents and the files their `attachments[]` already reference.

## What "delete an NCR" removes

An `Ncr` document (`model/ncr.js`) is a single document holding every piece
of that NCR's data as embedded sub-fields/subdocuments — there is no separate
per-NCR collection (unlike Form/Traveler, which have a standalone `History`
collection per `model/history.js`). Deleting the document therefore removes,
as one unit:

| Embedded data | Field(s) |
|---|---|
| Core NCR fields | `ncr_number`, `originator_id`/`name`, `part_name`/`number`/`revision`, `supplier_name`, `wbs_number`, `description_of_nonconformance`, `status`, … |
| Disposition | `disposition.{parts_disposition, rework_repair_instructions, ce_cs_identity, ce_cs_timestamp}` |
| Preventive actions | `preventive_actions[]` (each with its own `status_history[]`, `comments[]`) |
| Additional approvers | `additional_approvers[]` |
| Closure record | `closure_record` |
| Full audit trail | `events[]` (every `NCR_EVENT_TYPES` entry ever recorded for this NCR, including all past notification delivery records) |
| Attachment metadata | `attachments[]` (`file_id`, `file_name`, `file_type`, `file_path`, …) |

No other Mongoose model references an `Ncr` by id (unlike, say,
`TravelerData`/`TravelerNote` referencing a `Traveler`), so deleting the
`Ncr` document alone leaves no orphaned rows in any other collection.

## What "delete an NCR" removes outside the database

Each entry in `attachments[]` has a `file_path` pointing to a file under
`config.uploadPath` on disk (set by `multer` at upload time — see
`lib/ncr-service.js`'s `addAttachments()`). Deleting an NCR unlinks every one
of these files, in addition to deleting the document. This is the one place
this feature's cleanup extends beyond the document itself.

## New service function

One new function in `lib/ncr-service.js`, following the file's established
per-action-function convention (one function per state-changing operation):

- **`deleteNcr(ncrId, user)`**: verifies `user.roles` includes `'admin'`
  (FR-001/FR-003 — else throws a 403), loads the `Ncr` by id (throws 404 if
  not found — this is what makes a batch's already-deleted entry a per-call
  404 rather than a special server-side case, per research.md Decision 2),
  best-effort-unlinks every `attachments[].file_path` (research.md Decision
  3 — errors logged, never thrown), then deletes the document.

## No new/changed `NCR_EVENT_TYPES`, no new event

Per research.md Decision 4 (spec.md's resolved clarification), nothing is
appended anywhere — not to the NCR's own `events[]` (which is being deleted
along with everything else), and not to any other collection. There is
deliberately no `ncr.deleted` (or similar) event type.

## Relationships

```
Ncr  ──(attachments[].file_path)──>  file on disk under config.uploadPath
```

Deleting the `Ncr` document and unlinking every file it points to together
remove 100% of that NCR's persisted footprint (SC-004: "no orphaned data
(database or file) remains for it").
