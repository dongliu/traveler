<!--
SYNC IMPACT REPORT
==================
Version change:   [unversioned template] → 1.0.0  (initial adoption)
Modified:         All placeholder tokens replaced with project-specific content
Added sections:   Technology Stack, Development Workflow
Removed sections: None (template sections renamed and filled)
TODOs deferred:   None — all placeholders resolved
-->

# Traveler Constitution

## Core Principles

### I. Lifecycle State Machine (NON-NEGOTIABLE)

All core entities (Form, Traveler, Binder) MUST be governed by explicit state machines with
validated transitions via `stateTransition`. No code may directly mutate a state field to bypass
validation. Valid states and transitions MUST be documented in the model file.

Form states: `0`=draft → `0.5`=under review → `1`=released → `2`=archived.
Traveler states: `0`=not started → `1`=in progress → `1.5`=submitted → `2`=approved →
`3`=frozen → `4`=archived.

Rationale: The integrity of the work-instruction lifecycle is the core value the system delivers.
Silent or unauthorized state changes corrupt audit trails and approvals.

### II. Permission-Layered Access Control

Every route that accesses a protected document MUST use the `req-utils.js` middleware factories
(`exist`, `canReadMw`, `isOwnerMw`, `requireAdmin`). Inline permission checks inside route handler
bodies are forbidden.

The permission hierarchy MUST be honored in order: owner → reviewer → sharedWith → sharedGroup →
publicAccess. New access patterns MUST fit within this hierarchy or extend it through shared
middleware — never around it.

Rationale: Centralizing access control prevents divergent or missing checks that could expose
sensitive work documents.

### III. Two-Server Separation

The web app server (session-authenticated, Jade UI) and the REST API server (basic-auth,
JSON-only) MUST remain architecturally separate. Route files for one MUST NOT be mounted on the
other. Shared logic belongs in `/lib/` or `/utilities/`, not in route files.

Rationale: The two client types (browser users vs. API consumers) have fundamentally different
authentication models. Conflating them creates security risks and breaks the API contract.

### IV. Composable Model Features

Cross-cutting entity behaviors (review workflow, sharing, audit history) MUST be implemented as
composable schema mixins — `addReview(schema)`, `addShare(schema)`, etc. — and applied to entity
schemas. Duplicating this logic per model is forbidden.

Rationale: Duplication of review or sharing logic across Form, Traveler, and Binder would cause
behavioral drift and make compliance updates error-prone.

### V. Minimal, Build-Free Frontend

The frontend MUST use jQuery + Bootstrap served statically. No build pipeline, no frontend
framework, no bundler. New UI features MUST follow the existing pattern: Jade templates + static
JavaScript files in `/public/javascripts/`.

Rationale: Introducing a build step would complicate deployment on institutional infrastructure.
The current approach keeps the deployment footprint minimal and operator-friendly.

## Technology Stack

- **Runtime**: Node.js, Express 4.x — framework upgrades require a documented migration plan
- **Database**: MongoDB via Mongoose — schemas MUST define explicit state fields; schemaless
  workarounds are forbidden
- **Templating**: Jade (Pug) — all server-rendered views MUST use `routesUtilities.getRenderObject`
  to inject standard locals (`prefix`, `viewConfig`, `roles`, `helper`)
- **Logging**: Winston via `lib/loggers.js` — `console.log` in production code paths is forbidden;
  use `getLogger()`
- **Testing**: Mocha — all new `lib/` functions MUST have corresponding tests in `test/lib/`
- **Config**: All runtime config lives outside the repo at `../etc/traveler-config/`; hardcoded
  secrets or environment-specific values in source are forbidden
- **MQTT**: Optional; gated on the presence of `mqtt.json` in config. The application MUST start
  and operate fully without it

## Development Workflow

- Code style MUST pass `eslint` and `prettier` checks before merge
- Every new route MUST have at least a smoke test validating the happy path
- The REST API (`routes/api.js`) MUST remain backward-compatible; breaking changes require a
  versioned endpoint
- Config schema changes MUST update both the example files in `/config/` and the loader in
  `config/config.js`
- The `saveWithHistory(userid)` method MUST be used for all entity mutations that constitute an
  audit-relevant action

## Governance

This constitution supersedes all conflicting ad-hoc conventions in the codebase. When a PR or
decision conflicts with a principle, the principle prevails unless an amendment is ratified.

**Amendment procedure**:
1. Propose the change with written rationale referencing the affected principle.
2. Review by the maintainer(s) — changes to Principles I–III require explicit approval.
3. Update this document with a version bump per the versioning policy below.
4. Record the new amendment date.

**Versioning policy**:
- MAJOR: Removal or redefinition of a Core Principle
- MINOR: New principle or section added; materially expanded guidance
- PATCH: Wording clarifications, typo fixes, non-semantic refinements

**Compliance**: All code reviews MUST verify that changes comply with the Core Principles.
Violations MUST be flagged as blocking, not advisory. Use `CLAUDE.md` for runtime development
guidance on commands, file structure, and patterns.

**Version**: 1.0.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-23
