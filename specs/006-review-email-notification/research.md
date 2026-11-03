# Research: Form Review Request Email Notification

## Finding 1: Dedicated Email Config File — Required, Not Optional

**Decision**: Create a new required config file `email.json` (template `config/email_change.json`, deployed example `docker/email.json`), loaded in `config/config.js`'s `load()` via plain `require('../' + configPath + '/email.json')` — the same way `ad.json`, `api.json`, `app.json`, `auth.json`, `mongo.json`, `service.json`, and `ui.json` are already loaded (not via `optionalRequire`, which is reserved for `mqtt.json`). It holds `smtp_host`, `smtp_port`, `smtp_ssl`, `smtp_tls`, `notification_email_address`, and `disclaimer`. Remove those five keys from `config/app_change.json` and `docker/app.json`.

**Rationale**: Per the `/speckit-clarify` session (see spec.md Clarifications), the application must refuse to start if this file is missing, matching the strictness of the other mandatory config files it's being split out of. These settings were already mandatory inside the already-required `app.json`, so moving them to their own required file changes *where* they live, not whether they're required.

**Alternatives considered**: Load it with `optionalRequire` like `mqtt.json` (fail-soft) — rejected per the explicit clarification answer; fail-soft was the pre-clarification assumption but the user chose fail-fast instead.

---

## Finding 2: `lib/email.js` Must Read From the New Config Namespace, and Gains `cc`

**Decision**: Update `lib/email.js`'s five references to `config.app.smtp_host` / `smtp_port` / `smtp_ssl` / `smtp_tls` / `notification_email_address` to read from `config.email.*` instead. Add a `config.email.disclaimer` read point for callers that need to append it. Separately, `sendNotification({ subject, recipients, from, text, html })` has no `cc` parameter today — extend its signature to accept an optional `cc` and forward it to `nodemailer`'s `sendMail` unchanged (same pass-through treatment as `to`/`from`), since `specs/email.md`'s review-request template requires cc'ing the form owner and nothing else in the codebase currently needs `cc`.

**Rationale**: `lib/email.js` (`initTransport`, `sendNotification`) is the single existing integration point for all outgoing mail in the codebase. Updating its config reads is the entire config "move"; adding `cc` to its existing contract (rather than building a second, review-specific send path) keeps that single-integration-point property intact.

**Alternatives considered**: Leave `lib/email.js` reading `config.app` and only move the JSON file — rejected; it would silently break mail sending (the fields would be `undefined`) while technically satisfying "the file exists." Building the cc'd send directly against `nodemailer` from `lib/review.js` — rejected; duplicates transport/pooling logic `lib/email.js` already owns.

---

## Finding 3: Where the Notification Is Triggered

**Decision**: Trigger the send (and the record of it — Finding 5) inside `lib/review.js`'s existing `addReviewRequest(req, res, doc)`, immediately after `await doc.requestReview(req.session.userid, reviewer)` succeeds and before the `201` response is sent.

**Rationale**: `addReviewRequest` is already the single shared function `routes/form.js`'s `POST /forms/:id/review/requests` delegates to (documented in `CLAUDE.md`'s "Review workflow pattern" as shared between form and traveler routes). Putting the side effect here, rather than in the route handler, keeps it reusable if a traveler review workflow is ever wired up, consistent with the constitution's Composable Model Features principle.

**Alternatives considered**: Trigger from the route handler in `routes/form.js` directly — rejected; duplicates logic outside the documented shared integration point.

---

## Finding 4: Auto-Provisioning a Reviewer Account From AD

**Decision**: Inside `addReviewRequest`, when `User.findById(uid.toLowerCase())` returns nothing (today this returns a `400` telling the owner to add the user manually), perform a server-side directory lookup by `uid` using `lib/ldap-client.js`'s `search()` with `ad.searchFilter` — the same lookup shape already used by `updateUserProfile` and `fetch_photo_from_ad` in `routes/user.js` — and, on exactly one match, create the `User` document from the looked-up `displayName`/`mail`, mirroring `storeUser` in `routes/user.js` (minus role assignment). Zero or multiple matches keep today's `400` rejection. The existing `if (!reviewer.roles.includes(Reviewer))` check immediately after is left completely unchanged — a freshly auto-created account has no roles, so it still fails that check until an administrator grants the Reviewer role, exactly per the `/speckit-clarify` answer.

**Rationale**: Reuses an already-audited AD query pattern instead of a new one; never trusts client-supplied `name`/email for the account (the browser-side typeahead data is only used today for the initial `uid`/`name` pair in the request body) — consistent with the spec's Assumption that directory data, not browser input, is authoritative. Leaves the permission model (who can hold the Reviewer role) completely untouched, per clarification.

**Alternatives considered**: Trust `req.body.name` and add an email field to the request body — rejected as a data-integrity concern; nothing else in the codebase trusts client-supplied AD-sourced fields.

---

## Finding 5: Notification Record Storage

**Decision**: Add a new sub-schema `reviewNotification` (`recipient: String`, `sentOn: Date`, `success: Boolean`, `type: String` default `'request'`) and a `reviewNotifications: [reviewNotification]` array to the existing `review` schema in `model/review.js` — the same schema the `addReview(schema)` mixin attaches to a host document as `__review`. Add a schema method `addReviewNotification(recipient, success)` (parallel to the existing `addReviewResult`) that pushes an entry and saves; call it from `lib/review.js` right after the send attempt, regardless of outcome.

**Rationale**: Keeps the audit trail inside the composable review mixin (constitution principle IV) instead of a one-off field on `model/form.js`. Because `GET /forms/:id/review/json` already returns `form.__review` verbatim (`routes/form.js`, `res.status(200).json(form.__review || {})`), the new array is automatically exposed to anyone who can already view that form's review information — satisfying FR-008 with zero route changes.

**Alternatives considered**: A top-level `notifications` array directly on `model/form.js` — rejected; bypasses the composable mixin and would need its own new, separately-gated route to expose it, duplicating work the existing endpoint already does for `reviewRequests`/`reviewResults`.

---

## Finding 6: Email Content Construction

**Decision**: Compose the subject/body for the review-request email directly in `lib/review.js` from data already in scope at the call site — `doc.title` (form title), `doc.owner` (resolved via `User.findById` for the owner's name/email to CC), the reviewer's `name`/email, and the form URL `${req.proxied ? authConfig.proxied_service : authConfig.service}/forms/${doc._id}/` (the existing `formBuilder` route in `routes/form.js` that a reviewer already lands on and sees their pending review via the `isReviewer`/`review` render locals — not the owner-only `/forms/:id/review/` management page). Follow `specs/email.md`'s "review request" layout verbatim (title, from, to, cc, greeting, body, disclaimer, closing), appending `config.email.disclaimer`. Send via `lib/email.js`'s `sendNotification({ subject, recipients, from, cc, text })` — using the `cc` parameter added in Finding 2.

**Rationale**: The email body is five fixed lines with simple substitutions — well within plain string building, no new templating dependency needed. Confirms the correct reviewer-facing URL (the `isOwnerMw`-gated `/forms/:id/review/` page is for the *owner* to manage reviewers, not for the reviewer to act).

**Alternatives considered**: A Jade template for the email body — rejected; Jade in this codebase renders HTTP responses, not emails, and introducing it here for five lines of text would be an unjustified new pattern.

---

## Finding 7: Test Coverage

**Decision**: Add `test/lib/review-test.js` (no test file exists for `lib/review.js` or `model/review.js` today) covering: `addReviewRequest`'s auto-create-on-miss path, the unaffected role-check rejection immediately after creation, the ambiguous/not-found directory rejection, and the notification send-and-record side effect — stubbing `lib/email.js` and `lib/ldap-client.js` with `sinon`, following the existing stubbing style in `test/lib/email-test.js` and `test/lib/ldap-client-test.js`. Update `test/lib/email-test.js` to seed `config.email` instead of `config.app` for the smtp/notification fields it currently sets.

**Rationale**: The constitution requires new `lib/` functions to have corresponding tests in `test/lib/`; this feature also happens to be the first to touch `lib/review.js`, which has no prior coverage.
