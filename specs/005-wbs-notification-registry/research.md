# Research: WBS Notification Registry

**Date**: 2026-08-22

No external research required — every decision below is resolved by reading
the existing codebase's own established conventions for admin-managed lists.

---

## Decision 1: Admin-only access mechanism

**Decision**: Chain `auth.ensureAuthenticated` then `reqUtils.requireAdmin()`
on every registry route, exactly as `routes/admin.js` already does for the
`/admin/` page itself.

**Rationale**: `reqUtils.requireAdmin()` (`lib/req-utils.js:454`) already
implements "reject with 403 unless `res.locals.roles` includes `'admin'`" —
`res.locals.roles` is populated globally by `auth.sessionLocals`
(`app.js`). This is the exact mechanism the codebase already uses to gate
admin-only actions; no new permission logic is needed for FR-008.

**Alternatives considered**:
- A new bespoke role/permission check → rejected, duplicates existing
  infrastructure for no benefit.
- Checking `roles.includes('manager') || roles.includes('admin')` (the
  broader clause used in `lib/ncr-service.js`'s `buildRoleScope`) → rejected;
  the spec says "the admin" specifically, and `requireAdmin()` already
  encodes exactly that narrower rule as the codebase's standard admin gate.

---

## Decision 2: UI placement — new tab on the existing `/admin/` page

**Decision**: Add a third Bootstrap tab, "WBS Notifications," to
`views/admin.jade`, alongside the existing "Users" and "Groups" tabs, backed
by a new `table#wbs-notifications-table` populated via the same
jQuery+DataTables pattern already used for `#users-table`/`#groups-table`.

**Rationale**: `/admin/` is already the single, established home for
admin-managed lists in this app. Adding a third tab is a drop-in extension
of an existing, working UI convention rather than introducing a new page or
a new UI pattern.

**Alternatives considered**:
- A standalone `/admin/wbs-notifications` page → rejected; unnecessary given
  the existing tabbed layout already accommodates exactly this shape of
  feature (a titled list with an inline add-form and a table).

---

## Decision 3: Model → service → route layering (not routes/group.js's
embedded-logic style)

**Decision**: Introduce `lib/wbs-notification-service.js` for all business
logic (format validation, uniqueness enforcement, CRUD), with
`routes/wbs-notification.js` limited to HTTP concerns (parsing, status
codes, calling the service) — mirroring `lib/ncr-service.js` /
`routes/ncr.js`.

**Rationale**: The constitution's Code Quality principle states "Logic
SHOULD be abstracted into shared libraries (in `lib/`) rather than embedded
in routes." The NCR module (this session's own prior work) already
establishes this layering as the current standard for new features, even
though older modules (`routes/group.js`) historically embedded logic
directly in the route. Following the newer, constitution-aligned pattern
keeps the codebase converging rather than adding a second embedded-logic
example.

**Alternatives considered**:
- Embedding logic directly in `routes/wbs-notification.js` (matching
  `routes/group.js`'s older style) → rejected in favor of the
  constitution-preferred, more recently established layering.

---

## Decision 4: WBS number format validation rule

**Decision**: A WBS number is valid if it matches one or more non-empty
segments separated by single `.` characters — equivalent to the regular
expression `^[^.]+(\.[^.]+)*$` after trimming surrounding whitespace. Segment
contents themselves are unrestricted (any non-empty, non-dot substring).

**Rationale**: Directly implements FR-003's plain-language rule ("one or
more non-empty segments separated by single `.` characters, with no leading,
trailing, or consecutive dots"). Segment *contents* are deliberately left
unrestricted (letters, digits, hyphens, etc. all permitted) since the spec
does not constrain what a segment may contain, only how segments are
delimited — and the existing free-text `wbs_number` field on `model/ncr.js`
already accepts arbitrary strings like `WBS-1` with no character-class
restriction, so this registry should not be stricter than necessary.

**Alternatives considered**:
- Restricting segments to digits only (a common WBS convention, e.g.
  `1.2.3`) → rejected; real-world WBS numbering conventions vary by
  organization (letters, hyphens within a segment are common), and nothing
  in the spec or the existing `wbs_number` field usage in this app requires
  digit-only segments.

---

## Decision 5: Email syntax validation

**Decision**: Validate with a standard pragmatic email-shape check
(`local@domain` with no whitespace, at least one `.` in the domain part) —
the same level of rigor as the ce_cs typeahead's email field elsewhere in
this app, not full RFC 5322 parsing.

**Rationale**: FR-005 only requires "syntactically valid," not deliverability
verification (out of scope — no new dependency needed to send a test email or
integrate a verification service). A pragmatic regex is standard practice
for this class of requirement and consistent with how the rest of the app
handles email fields (e.g., `ce_cs_email` is passed through untouched from
the typeahead index, never independently re-validated with a heavyweight
parser).

**Alternatives considered**:
- Full RFC 5322-compliant parsing → rejected as disproportionate; no
  dependency for this exists in the current `package.json`, and the spec's
  own bar ("syntactically valid") does not demand it.
