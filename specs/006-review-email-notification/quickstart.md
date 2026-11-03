# Quickstart Validation Guide: Form Review Request Email Notification

Use this guide to verify the feature works end-to-end after implementation. Each scenario maps to a user story from [spec.md](spec.md).

## Prerequisites

- Application running locally (`node app.js` or `npx nodemon`), configured against a local/dev `../etc/traveler-config/` directory that now includes `email.json` (see [contracts/email-config.md](contracts/email-config.md))
- A local SMTP catcher reachable at the configured `smtp_host`/`smtp_port` (e.g. the `mail-service` container already referenced by `docker/app.json`, or any local dev mail-catcher such as MailDev/Mailpit) so sent mail can be inspected
- A form owner account with a draft form already submitted for review (status `0.5`) and at least one reviewer candidate available in the organization directory (AD/LDAP test fixture) who does **not** yet have an eTraveler account
- Admin credentials, to grant the Reviewer role

---

## Scenario 1 — Known Reviewer Gets Notified (FR-001, FR-002, FR-003; User Story 1)

**Goal**: Verify the review-request email is sent when an already-known reviewer is assigned.

1. Ensure the assignee already has an eTraveler account with the Reviewer role and an email on file.
2. As the form owner, open the form under review and assign that person as a reviewer (`POST /forms/:id/review/requests`).
3. **Expected**: `201 Created`, and the reviewer is added to the review list immediately (unchanged from today).
4. Check the SMTP catcher: **Expected** one email, to the reviewer, cc'ing the form owner, from the configured `notification_email_address`, with subject/body matching `specs/email.md`'s "review request" template, ending in the configured disclaimer text.
5. `GET /forms/:id/review/json` → **Expected**: `reviewNotifications` contains one entry for this reviewer with `success: true`.

**Repeat** with the SMTP relay stopped/unreachable:
- **Expected**: Step 3's `201 Created` and review-list addition still happen. `reviewNotifications` records `success: false` instead.

---

## Scenario 2 — Brand-New Directory User Gets Auto-Provisioned, Not Auto-Authorized (FR-009, FR-010, FR-011, FR-012; User Story 2)

**Goal**: Verify a directory user with no eTraveler account gets a minimal account created, but still needs an administrator to grant the Reviewer role before the assignment completes.

1. As the form owner, assign a reviewer by the `uid`/`name` of a directory user who has never logged into eTraveler (no existing `User` document).
2. **Expected**: `400 Bad Request` — "needs to have reviewer role" (same wording as today's role-check rejection), **not** the old "please add user id ... to etraveler user list" message.
3. Inspect the `User` collection directly (or via admin UI): **Expected**: a `User` document now exists for that `uid`, with `name` and `email` populated from the directory, and `roles: []`.
4. As an admin, grant that user the Reviewer role.
5. As the form owner, retry the same assignment.
6. **Expected**: `201 Created`; the reviewer is added; the notification email in Scenario 1 is sent to the email address that was auto-populated in step 3 — nobody had to look it up or type it in by hand.

**Repeat** with a `uid` that matches zero or more than one person in the directory:
- **Expected**: `400 Bad Request`, no `User` document created, same as today's handling of an unrecognized reviewer id.

---

## Scenario 3 — Form Keeps a Record of Notifications (FR-008; User Story 3)

**Goal**: Verify the form's own data answers "was this reviewer notified?" without checking server logs.

1. Complete Scenario 1 (successful send) and Scenario 1's repeat (failed send) against two different reviewers on the same form.
2. `GET /forms/:id/review/json` as the form owner.
3. **Expected**: `reviewNotifications` has two entries — one `success: true` for the first reviewer, one `success: false` for the second — each with a `recipient` and `sentOn` timestamp.
4. Confirm a user who is neither the owner nor an admin and cannot already view this form's review information still cannot reach `GET /forms/:id/review/json` (`403`/`401`, unchanged from today's `isOwnerMw` gate) — i.e., no new, wider exposure was introduced.

---

## Scenario 4 — Missing Email Config Fails Startup (FR-007)

**Goal**: Verify the required-config behavior from the clarification session.

1. Temporarily rename/remove `email.json` from the config directory.
2. Start the application.
3. **Expected**: the application fails to start (same class of failure as removing `app.json` or `ad.json`), rather than starting with email notifications silently disabled.
4. Restore `email.json` and confirm the application starts normally again.

---

## Automated Test Touchpoints (for `test/lib/`)

After implementing, add or extend tests in `test/lib/` (Mocha, Sinon) covering:

- `model/review.js`'s new `addReviewNotification` method appends an entry and persists it.
- `lib/review.js`'s `addReviewRequest`:
  - auto-creates a `User` from a stubbed AD lookup when none exists, with `roles: []`
  - still rejects with the existing "needs reviewer role" message right after that auto-creation
  - rejects without creating anything when the stubbed AD lookup returns zero or multiple matches
  - calls `lib/email.js`'s `sendNotification` and records the outcome via `addReviewNotification` on both success and failure, without that outcome affecting the HTTP response
- `test/lib/email-test.js` updated to seed `config.email` (not `config.app`) for `smtp_host`/`smtp_port`/`smtp_ssl`/`smtp_tls`/`notification_email_address`.
- `config/config.js` throws/fails when `email.json` is absent (mirrors how a missing `app.json` already behaves).

Run with: `npx mocha test/lib/`

---

## Validation Checklist

- [ ] Scenario 1 (known reviewer, mail relay up) passes
- [ ] Scenario 1 (known reviewer, mail relay down — assignment still succeeds) passes
- [ ] Scenario 2 (brand-new directory user auto-provisioned, still blocked on role) passes
- [ ] Scenario 2 (ambiguous/unknown directory id still rejected, no account created) passes
- [ ] Scenario 3 (notification record visible via existing review/json endpoint) passes
- [ ] Scenario 3 (no wider access introduced) passes
- [ ] Scenario 4 (missing email.json fails startup) passes
