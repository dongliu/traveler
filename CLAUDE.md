# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the app
node app.js

# Development (auto-restart on file changes, NODE_ENV=development)
npx nodemon

# Lint
npx eslint .

# Format
npx prettier --write .

# Run all tests
npx mocha test/lib/

# Run a single test file
npx mocha test/lib/req-utils-test.js

# End-to-end tests (Playwright; needs the docker stack running and E2E_* settings)
npm run e2e
npm run e2e -- e2e/us1-form-lifecycle.spec.js
```

## Architecture

**Traveler** is an Express.js web application for managing procedure-based work instructions ("travelers"). It supports a lifecycle: draft form templates → submitted for review → released forms → traveler instances → completed/approved.

### Two Express instances

`app.js` starts two servers:
- **Web app** (`app`) — session-authenticated, Jade-rendered UI
- **REST API** (`api`) — basic-auth, JSON-only, defined in `routes/api.js`

### Configuration

All runtime config lives outside the repo in `../etc/traveler-config/` (or the path in env var `TRAVELER_CONFIG_REL_PATH`). The `/config/config.js` loader merges JSON files from that directory: `ad.json`, `api.json`, `app.json`, `auth.json`, `email.json`, `mongo.json`, `permission.json`, `service.json`, `ui.json`, and optionally `mqtt.json`. `permission.json` maps each role (including the implicit default `user` role) to the permissions it grants — see `lib/permission.js`. The `/config/` directory in the repo contains only defaults/examples. `email.json` is required (not optional like `mqtt.json`) and holds the outgoing-mail settings (`smtp_host`, `smtp_port`, `smtp_ssl`, `smtp_tls`, `notification_email_address`, `disclaimer`) that `lib/email.js` reads — these used to live in `app.json`.

### Models (`/model/`)

Mongoose schemas. Two categories:

**Entity models** with state machines:
- `form.js` — Templates. States: `0`=draft → `0.5`=under review → `1`=released → `2`=archived. Uses `stateTransition` for validated transitions.
- `released-form.js` — Immutable snapshots of approved forms.
- `traveler.js` — Work instances created from released forms. States: `0`=not started → `1`=in progress → `1.5`=submitted for review → `2`=approved → `3`=frozen → `4`=archived.
- `binder.js` — Collections of travelers.
- `user.js`, `history.js`

**Attachable feature models** mixed into entity schemas via `addReview(schema)`, `addShare(schema)`, etc.:
- `review.js` — Approval workflow. Stores `reviewRequests` (who was asked), `reviewResults` (what they decided), and `reviewNotifications` (who was emailed, when, and whether it succeeded — `addReviewNotification(recipient, success)`). `reviewRequests._id` is the reviewer's userid. `allApproved()` checks the latest result per reviewer against current `_v`.
- `share.js` — Fine-grained access: `sharedWith` (per-user), `sharedGroup` (per-group), `publicAccess`.
- `history.js` — Audit trail via `saveWithHistory(userid)`.

### Routes (`/routes/`)

Each route file exports `function(app)` and is mounted in `app.js`. Key files:
- `form.js` — Form CRUD, form builder UI, review request/result endpoints
- `traveler.js` — Traveler CRUD, data submission, review endpoints
- `binder.js` — Binder management
- `admin.js` — User/group admin
- `review.js` — Review list views

### Shared libraries (`/lib/`)

- `req-utils.js` — Middleware factories used heavily in routes: `exist(param, Model)`, `canReadMw(param)`, `isOwnerMw(param)`, `requireAdmin()`, `requirePermission(permission)`, `status(param, [allowed])`, `isAdmin(req)`, `isOwner(req, doc)`.
- `public-travelers.js` — Paged, filterable list of public travelers (JSON or CSV), one `listHandler(Traveler, options)` mounted on both the web app (`/publictravelers/list`) and the REST API (`/apis/publictravelers/`). The public tier itself is `reqUtils.publicAccessMatch()` in `req-utils.js`, next to `getAccess`; never write a `publicAccess` query condition elsewhere.
- `review.js` — `addReviewResult`, `addReviewRequest`, `removeReviewRequest` — shared between form and traveler routes. `addReviewRequest` auto-provisions a minimal `User` (name/email from AD) when the given reviewer id has no account yet — the separate requirement that the account's effective permissions include `Review_forms` is untouched — then, once the request succeeds, sends the review-request email (`specs/email.md`) via `lib/email.js` and records the attempt with `doc.addReviewNotification(...)`.
- `email.js` — `sendNotification({ subject, recipients, from, cc, text, html })` over a pooled SMTP transport built from `config.email`. Failures are logged and swallowed, never thrown — callers get `false` back instead of a rejected promise.
- `auth/index.js` — Sets `res.locals.roles`, `res.locals.permissions`, `res.locals.userid` from session. `isAdmin` in views is derived from `roles.indexOf('admin') !== -1` in `views/layout.jade`.
- `role.js` — Role constants: `Manager`, `Admin`, `Reviewer`. `Roles` lists the three roles an admin can add to or remove from an account. The default role, `user`, is implicit (every account always holds it; it is never stored and never shown as addable/removable) and is not in this file.
- `permission.js` — Permission constants: `Read_all_forms`, `Write_active_travelers`, `Review_forms`, `Approve_travelers`, `Manage_users`. `getPermissions(roles)` unions the permissions granted by the given roles per the `config.permission` mapping (`permission.json`), filtered to the known permission list. `lib/auth/index.js` calls this once per request to populate `res.locals.permissions`; `utilities/routes.js`'s `hasPermission(req, permission)` and `reqUtils.requirePermission(permission)` read it from there.
- `loggers.js` — Winston logger. Use `require('../lib/loggers').getLogger()`.

### Views (`/views/`)

Jade templates extending `layout.jade`. All renders go through `routesUtilities.getRenderObject(req, extraAttrs)` (`/utilities/routes.js`), which injects `prefix`, `viewConfig`, and a `helper` object; `roles` and `permissions` come from `res.locals` (set per-request by `lib/auth/index.js`'s `sessionLocals`) and reach templates via Express's locals merge, not through `getRenderObject`. Variables available in every template: `roles`, `permissions`, `isAdmin` (computed in `layout.jade`), `isManager`, `orgName`.

### Frontend (`/public/javascripts/`)

jQuery + Bootstrap UI. No build step — files are served statically. Key files:
- `form-builder.js` — Form template editor (TinyMCE, Rivets.js, drag-and-drop)
- `traveler.js` — Traveler data entry and workflow
- `review.js` — Review management table

### Review workflow pattern

The same `lib/review.js` functions handle both forms and travelers. The route-level `submitReview` middleware validates authorization (reviewer or admin-on-behalf), then delegates to `reviewLib.addReviewResult(req, res, doc)`. When `req.body.reviewerId` is present, it is used as the reviewer ID (admin override); otherwise `req.session.userid` is used.

### Permissions model

- `reqUtils.isAdmin(req)` — checks `res.locals.roles` for `'admin'`
- `reqUtils.isOwner(req, doc)` — checks `doc.createdBy` or `doc.owner` against `req.session.userid`
- `reqUtils.canReadMw(param)` — middleware; delegates to `getAccess()` which checks owner, reviewer, sharedWith, sharedGroup, publicAccess
- `isOwnerOrAdminMw` — allows either

### MQTT (optional)

If `mqtt.json` config exists, device value updates are published via `utilities/mqtt.js`. Traveler routes integrate MQTT for device-linked inputs.
