# Research: WBS YAML Config File

**Feature**: 007-wbs-yaml-config
**Date**: 2026-08-24
**Updated**: 2026-08-24 (post-clarification: admin page WBS management removed entirely)

## Decision 1: YAML Parsing Library

**Decision**: Add `js-yaml` as a production dependency for parsing `wbs.yaml`.

**Rationale**: `js-yaml` is the dominant Node.js YAML parser — battle-tested, actively maintained, and used by the broader ecosystem. The alternative of hand-rolling a parser for the simple `key: value` format is fragile (YAML has edge cases around quoting, colons in values, multiline strings) and creates maintenance debt.

**Critical subtlety — numeric-looking keys**: In standard YAML, an unquoted key like `1.2` is parsed as the floating-point number `1.2`, not the string `"1.2"`. `js-yaml` must be called with `{ schema: yaml.FAILSAFE_SCHEMA }`, which treats every scalar as a plain string, ensuring WBS numbers are preserved exactly as written.

**Alternatives considered**:
- Hand-rolled line-by-line parser: rejected — fragile, no benefit over a library.
- `yaml` (npm package): valid alternative, but `js-yaml` is more pervasive in the Node.js ecosystem.
- Native JSON config (`wbs.json`): rejected — the spec explicitly calls for YAML.

## Decision 2: Integration Point — Where to Load wbs.yaml

**Decision**: Load `wbs.yaml` inside `config/config.js` → `module.exports.load()`, using `fs.readFileSync` + `js-yaml.load()` synchronously — consistent with how all other config files are loaded. The parsed mapping is exposed as `config.wbsYaml` (a plain `{ [wbs_number]: email }` object, or `{}` on failure/absence).

**Rationale**: All application configuration is loaded synchronously in `config.load()` before the Express app initializes. Keeping YAML loading there means the data is available at the same time as `mongo`, `app`, and `service` configs. No async gymnastics needed; `js-yaml.load()` is synchronous.

**Alternatives considered**:
- Loading in `app.js` directly: works but scatters config loading across two files.
- Lazy loading (first time `resolveWbsContact` is called): adds complexity and makes startup log messages happen late.

## Decision 3: WBS Runtime Data Source

**Decision**: WBS mappings live in memory only (the `config.wbsYaml` plain object). The application MUST NOT query the `wbs_notifications` MongoDB collection at runtime for WBS resolution.

**Rationale**: Matches FR-010 and the clarification that the admin page approach is being entirely removed. A single in-memory source is simpler, faster, and eliminates the dual-source conflict logic that was needed when the DB was still an active source.

**Implications**:
- `resolveWbsContact` only walks the in-memory YAML map — no DB query.
- `listEntries` returns YAML-loaded entries only (tagged `source: 'config'`).
- The existing CRUD service functions (`addEntry`, `updateEntry`, `removeEntry`) are removed.
- The existing POST/PATCH/DELETE routes in `routes/wbs-notification.js` are removed.
- The GET route is retained (returns YAML-loaded entries read-only) for admin visibility.

## Decision 4: WbsNotification Mongoose Model and MongoDB Collection

**Decision**: Remove the `WbsNotification` Mongoose model (`model/wbs-notification.js`) and stop loading it in `app.js`. The `wbs_notifications` MongoDB collection is left in place in any existing database (no automatic migration or drop); administrators are responsible for copying desired entries into `wbs.yaml` before deploying.

**Rationale**: The model is no longer referenced at runtime (FR-010). Dropping it from the codebase reduces surface area. The collection is left in the database intentionally — dropping database collections in application code is destructive and irreversible; if cleanup is desired, it is a separate database administration step.

**Alternatives considered**:
- Keep the model as dead code for future use: rejected — dead code creates confusion.
- Add a startup migration that reads existing DB entries and writes them to a YAML file: out of scope per spec (migration is a manual admin responsibility per Assumptions).

## Decision 5: Admin Page WBS Section Disposition

**Decision**: Remove the WBS notification management section from the admin page entirely — the add/edit/delete UI and all associated JavaScript controls are deleted. Replace with a simple read-only display of YAML-loaded mappings (if any) so admins can verify what is active without modifying it through the UI.

**Rationale**: FR-009 says the management section MUST be removed; it MAY show a read-only view. A minimal read-only display provides operational visibility (confirming the YAML loaded correctly) without reintroducing management complexity.

**Alternatives considered**:
- Remove the entire admin page WBS section (no display at all): simpler code but reduces admin observability; the read-only view adds minimal complexity.
- Keep the management UI but make it disabled: confusing UX — a disabled form implies it could be enabled; removal is cleaner.

## Decision 6: Error Handling Strategy

**Decision**: Fail-open at the file level (if `wbs.yaml` is missing or fully unparseable, log and continue with no YAML mappings); warn-and-skip at the entry level (if individual lines are invalid, log per-entry warning, skip the bad entry, continue loading valid ones).

**Rationale**: Matches FR-003, FR-007, and FR-008. Fail-open ensures a bad YAML file never prevents the application from starting. WBS notifications simply produce no match for unmapped numbers.

**Alternatives considered**:
- Fail-hard on invalid file: prevents the app from starting, too disruptive for an optional config file.
- Silently ignore all errors: violates FR-007/FR-008 and makes debugging impossible.

## Decision 7: Existing e2e Tests for WBS Notification Registry

**Decision**: The existing e2e test file `e2e/us-wbs-notification-registry.spec.js` and `e2e/us-wbs-hierarchical-notification-lookup.spec.js` must be updated (or replaced) to test the YAML-based configuration approach instead of the admin page CRUD flow they currently exercise.

**Rationale**: Those tests exercise POST/PATCH/DELETE routes and admin page WBS management that are being removed. Leaving them would cause CI failures. New validation follows the scenarios in `quickstart.md`.
