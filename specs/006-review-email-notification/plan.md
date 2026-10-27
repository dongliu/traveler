# Implementation Plan: Form Review Request Email Notification

**Branch**: `006-review-email-notification` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-review-email-notification/spec.md`

## Summary

Send a review-request email (per `specs/email.md`) whenever a reviewer is successfully added to a form's review list, triggered from the existing shared `lib/review.js` `addReviewRequest` function. When the chosen reviewer has no eTraveler account yet, auto-create a minimal one from organization-directory (AD) data instead of rejecting the assignment outright — but leave the existing, separate requirement that the account hold the Reviewer role completely untouched. Record every notification attempt (recipient, timestamp, success) on the form itself, in a new `reviewNotifications` array inside the existing `review` schema mixin, exposed through the existing `GET /forms/:id/review/json` endpoint with no new route. Move the SMTP/notification settings out of `app.json` into a new, required `email.json` config file that also carries the standard disclaimer text.

No new architectural patterns are introduced: the change extends the existing `addReview(schema)` mixin, the existing shared review-request function, the existing AD-lookup pattern already used elsewhere in `routes/user.js`, and the existing per-topic config-file loading convention in `config/config.js`.

## Technical Context

**Language/Version**: Node.js (project's current version); Express 4.x

**Primary Dependencies**: Mongoose (schema change to `model/review.js`), `nodemailer` + `html-to-text` (already used by `lib/email.js`, unchanged), `ldapjs` (already used by `lib/ldap-client.js`, reused for the new AD lookup), Express (no new routes)

**Storage**: MongoDB via Mongoose — one additive sub-schema/array on the existing `review` schema (`reviewNotifications`); no changes to `Form`'s own fields; no migration needed since the array simply starts empty on existing documents

**Testing**: Mocha + Chai + Sinon, under `test/lib/` — new `test/lib/review-test.js` (first-ever coverage for `lib/review.js`/`model/review.js`) plus an update to `test/lib/email-test.js`'s config seeding

**Target Platform**: Web server (session-authenticated browser UI; the REST API server is untouched — this feature is web-app-only, matching how form review already works)

**Project Type**: Web application — existing single-repo Express monolith (session-authenticated web app + separate basic-auth REST API in the same codebase); no REST API changes needed for this feature

**Performance Goals**: No new performance considerations; the AD lookup and email send happen synchronously within the existing `POST /forms/:id/review/requests` request, the same way `routes/user.js`'s existing AD-backed routes already block on directory calls. No throughput target beyond "doesn't make this slower than other AD-backed admin actions already in the app."

**Constraints**: Email-send failure must never fail or roll back the reviewer assignment (FR-003); the new `email.json` config file is required at startup, not optional (FR-007, per clarification); no new npm dependencies; no new build pipeline; `config/config.js` loader and the `config/*_change.json` example files must be updated together per the constitution's config-schema-change rule; new `lib/` functions must log via `lib/loggers.js`, not `console.log`

**Scale/Scope**: Feature touches 1 model file (`model/review.js`), 1 lib file directly for the new behavior (`lib/review.js`) plus 1 lib file for config consumption (`lib/email.js`), the config loader and its example/deployed files (`config/config.js`, `config/app_change.json`, `config/email_change.json` (new), `docker/app.json`, `docker/email.json` (new)), and 1 new + 1 updated test file. No route, view, or frontend JS changes are required to satisfy the functional requirements (the notification record rides on the existing `GET /forms/:id/review/json` response).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Lifecycle State Machine | ✅ Pass | No new states or transitions. Form `stateTransition` (`0 → 0.5 → 1/2`) is untouched; the review-request flow already only runs at status `0.5` via the existing `reqUtils.status('id', [0.5])` guard. |
| II. Permission-Layered Access | ✅ Pass | All new behavior lives inside the already-gated `POST /forms/:id/review/requests` (`isOwnerMw`) and surfaces through the already-gated `GET /forms/:id/review/json` (`isOwnerMw`). No new route, no inline permission check, no change to who can grant the Reviewer role. |
| III. Two-Server Separation | ✅ Pass | All changes are in `lib/review.js`, `lib/email.js`, `model/review.js`, and `config/config.js` — shared/`lib`/`model` code and the web-app route file (`routes/form.js` is untouched: the behavior change is entirely inside the `lib/review.js` function it already delegates to). `routes/api.js` is untouched. |
| IV. Composable Model Features | ✅ Pass | `reviewNotifications` is added to the shared `review` schema inside the `addReview(schema)` mixin in `model/review.js`, not bolted directly onto `model/form.js` — any future entity adopting `addReview` gets it automatically. |
| V. Minimal, Build-Free Frontend | ✅ Pass | No frontend changes at all are required by the functional requirements. (If a future task chooses to surface `reviewNotifications` visually in `views/review.jade`/`public/javascripts/review.js`, it would use the existing jQuery + Bootstrap + AJAX pattern — no build step either way.) |

**Gate result**: All principles pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/006-review-email-notification/
├── plan.md                    ← this file
├── research.md                ← Phase 0 findings
├── data-model.md               ← Phase 1: schema changes
├── quickstart.md               ← Phase 1: validation guide
├── contracts/
│   ├── api-endpoints.md        ← Phase 1: modified endpoint contracts
│   └── email-config.md         ← Phase 1: new config file contract
├── checklists/
│   └── requirements.md         ← spec quality checklist
└── tasks.md                    ← Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
model/
└── review.js               # add reviewNotification sub-schema, reviewNotifications array,
                             # addReviewNotification() method on the addReview(schema) mixin

lib/
├── review.js                # addReviewRequest(): AD auto-create-on-miss (role check untouched),
                              # send review-request email, call addReviewNotification()
└── email.js                 # read smtp_*/notification_email_address/disclaimer from
                              # config.email instead of config.app; add `cc` param to
                              # sendNotification()

config/
├── config.js                 # add required `module.exports.email = require(...)` loader line
├── app_change.json           # remove smtp_*/notification_email_address keys
└── email_change.json         # NEW — template for the dedicated email config file

docker/
├── app.json                  # remove smtp_*/notification_email_address keys
└── email.json                # NEW — deployed email config for the Docker stack

test/lib/
├── review-test.js            # NEW — first coverage for lib/review.js and model/review.js
└── email-test.js             # updated to seed config.email instead of config.app
```

No changes are required in `routes/`, `views/`, or `public/javascripts/` to satisfy the functional requirements — `routes/form.js` already delegates to `lib/review.js` for both modified behaviors, and the new `reviewNotifications` data rides on the existing `GET /forms/:id/review/json` response untouched.

**Structure Decision**: Single-project Express monolith (existing web-app + REST-API servers in one repo). All changes extend existing files; no new routes, views, or frontend JS, and no new top-level directories beyond the two new config files and one new test file listed above.

## Complexity Tracking

*No constitution violations — this section is not applicable.*
