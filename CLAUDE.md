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
```

## Architecture

**Traveler** is an Express.js web application for managing procedure-based work instructions ("travelers"). It supports a lifecycle: draft form templates → submitted for review → released forms → traveler instances → completed/approved.

### Two Express instances

`app.js` starts two servers:
- **Web app** (`app`) — session-authenticated, Jade-rendered UI
- **REST API** (`api`) — basic-auth, JSON-only, defined in `routes/api.js`

### Configuration

All runtime config lives outside the repo in `../etc/traveler-config/` (or the path in env var `TRAVELER_CONFIG_REL_PATH`). The `/config/config.js` loader merges JSON files from that directory: `ad.json`, `api.json`, `app.json`, `auth.json`, `mongo.json`, `service.json`, `ui.json`, and optionally `mqtt.json`. The `/config/` directory in the repo contains only defaults/examples.

### Models (`/model/`)

Mongoose schemas. Two categories:

**Entity models** with state machines:
- `form.js` — Templates. States: `0`=draft → `0.5`=under review → `1`=released → `2`=archived. Uses `stateTransition` for validated transitions.
- `released-form.js` — Immutable snapshots of approved forms.
- `traveler.js` — Work instances created from released forms. States: `0`=not started → `1`=in progress → `1.5`=submitted for review → `2`=approved → `3`=frozen → `4`=archived.
- `binder.js` — Collections of travelers.
- `user.js`, `history.js`

**Attachable feature models** mixed into entity schemas via `addReview(schema)`, `addShare(schema)`, etc.:
- `review.js` — Approval workflow. Stores `reviewRequests` (who was asked) and `reviewResults` (what they decided). `reviewRequests._id` is the reviewer's userid. `allApproved()` checks the latest result per reviewer against current `_v`.
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

- `req-utils.js` — Middleware factories used heavily in routes: `exist(param, Model)`, `canReadMw(param)`, `isOwnerMw(param)`, `requireAdmin()`, `status(param, [allowed])`, `isAdmin(req)`, `isOwner(req, doc)`.
- `review.js` — `addReviewResult`, `addReviewRequest`, `removeReviewRequest` — shared between form and traveler routes.
- `auth/index.js` — Sets `res.locals.roles`, `res.locals.permissions`, `res.locals.userid` from session. `isAdmin` in views is derived from `roles.indexOf('admin') !== -1` in `views/layout.jade`.
- `role.js` — Role constants: `Manager`, `Admin`, `Reviewer`.
- `loggers.js` — Winston logger. Use `require('../lib/loggers').getLogger()`.

### Views (`/views/`)

Jade templates extending `layout.jade`. All renders go through `routesUtilities.getRenderObject(req, extraAttrs)` (`/utilities/routes.js`), which injects `prefix`, `viewConfig`, `roles`, and a `helper` object. Variables available in every template: `roles`, `isAdmin` (computed in `layout.jade`), `isManager`, `orgName`.

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
