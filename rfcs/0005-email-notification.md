# RFC: Email Notification

## Summary

Send email notifications to users when significant events occur in the application — including but not limited to the review workflow — to keep relevant parties informed without requiring them to poll the UI.

The design and implementation are split into two parts that ship independently:

- **Part 1 — Notification library**: `lib/email.js`, its unit tests, and a standalone script to verify the SMTP connection in the runtime environment. No application behavior changes.
- **Part 2 — Event integration**: wiring `sendNotification(...)` into application events. Deferred until the trigger event list is confirmed.

## Status

Part 1: Accepted — key transport decisions confirmed (basic unauthenticated SMTP; no `smtp_user`/`smtp_pass`).

Part 2: Proposed — trigger events to be confirmed.

## Motivation

Users currently have no way to learn about activity in the application without logging in and checking manually. This creates friction for time-sensitive workflows such as review approvals and traveler sign-offs, but the problem applies more broadly: any event where one user's action creates work or context for another user is a candidate for a notification.

Splitting the work lets the transport layer land and be validated against the real SMTP relay now, while the event list — a product decision, not a technical one — is settled separately.

---

## Part 1 — Notification Library

### Confirmed decisions

- **Basic SMTP is enough.** The runtime environment provides an SMTP relay that accepts mail from the application host without authentication. No `smtp_user` / `smtp_pass` config keys, no app passwords, no OAuth2 / Google service account setup. The earlier Google Workspace auth options (OAuth2 service account, app password) are dropped.

### Email delivery

Uses `nodemailer` with `html-to-text` to auto-generate a plain-text fallback from the HTML body.

The implementation lives in `lib/email.js` and exports:

```js
sendNotification({ subject, recipients, text, html })
```

- `recipients` may be a single address string or an array.
- If only `html` is provided, `html-to-text` generates the `text` part automatically.
- The transport is initialized lazily on first use and pooled (`maxConnections: 2`).
- The transport uses no `auth` option — connection is unauthenticated by design.
- Errors are logged via `lib/loggers` and never propagated — a mail failure must never break a request.
- The sender display name is `"eTraveler Notification"` with the configured notification address.

### Configuration

SMTP settings are read from `config.app` (i.e. `app.json`). The following keys are added:

| Key | Description |
|---|---|
| `smtp_host` | SMTP server hostname |
| `smtp_port` | SMTP server port |
| `smtp_ssl` | `true` to use TLS from the start |
| `smtp_tls` | `true` to allow STARTTLS upgrade |
| `notification_email_address` | The From address for outbound notifications |

Per the constitution (Configuration Externalization), real values live in `../etc/traveler-config/app.json`; the repo's `config/app_change.json` gains example entries only.

### Unit tests

`test/lib/email-test.js` (Mocha + Chai + Sinon), covering every export of `lib/email.js` per constitution Principle III:

- `sendNotification` normalizes a single recipient string to an array.
- `text` is auto-generated from `html` when omitted.
- The transport is created once (lazy init) and reused across calls.
- Transport errors are logged and swallowed — the returned promise never rejects.
- Sender field combines the display name and `notification_email_address`.

Tests stub the nodemailer transport; no real SMTP traffic.

### SMTP connection check script

`tools/check-smtp.js` — a standalone Node script to validate the SMTP path from the actual runtime environment (the app host inside the relay's allowlist), where a developer laptop cannot stand in:

```
node tools/check-smtp.js                     # verify connection/handshake only
node tools/check-smtp.js someone@example.com # verify, then send a test message
```

Behavior:

1. Loads SMTP settings through `config/config.js` (same path the app uses — also validates the deployed `app.json`).
2. Builds the same transport shape as `lib/email.js` and calls `transport.verify()` to exercise DNS, TCP connect, and the SMTP handshake (including STARTTLS when `smtp_tls` is set).
3. With an address argument, sends a small test message via `sendNotification` so the full delivery path (relay acceptance, From address validity) is confirmed end to end.
4. Prints a clear pass/fail per step and exits non-zero on failure — usable in install/upgrade checklists (`sbin/` runbooks can call it).

### Part 1 deliverables

| Artifact | Purpose |
|---|---|
| `lib/email.js` | `sendNotification` + lazy pooled transport |
| `test/lib/email-test.js` | Unit tests (stubbed transport) |
| `tools/check-smtp.js` | Runtime SMTP verification script |
| `config/app_change.json` | Example SMTP keys |
| `package.json` | Add `nodemailer`, `html-to-text` |

Part 1 has no user-visible behavior: nothing calls `sendNotification` yet.

---

## Part 2 — Event Integration (deferred)

> **To be confirmed.** The event list below is a candidate set carried over from the original proposal. Part 2 design finalizes which events fire, their recipients, and exact subject/body wording; only then are integration points implemented.

### Candidate trigger events

#### Form review

| Event | Recipient | Subject | Body |
|---|---|---|---|
| Review requested on a form | The requested reviewer | "Review requested: {form title}" | Who requested the review, link to the form |
| Review result submitted on a form | The form owner | "Review result: {form title}" | Reviewer name, result (approved / rejected), comment, link to the form |
| Review request removed | The reviewer | "Review request removed: {form title}" | Who removed the request, link to the form |

#### Form release

| Event | Recipient | Subject | Body |
|---|---|---|---|
| Form released (state → 1) | The form owner | "Form released: {form title}" | Link to the released form |
| Form archived (state → 2) | The form owner | "Form archived: {form title}" | Link to the form |

#### Traveler lifecycle

| Event | Recipient | Subject | Body |
|---|---|---|---|
| Review requested on a traveler | The requested reviewer | "Review requested: {traveler title}" | Who requested the review, link to the traveler |
| Review result submitted on a traveler | The traveler owner | "Review result: {traveler title}" | Reviewer name, result (approved / rejected), comment, link to the traveler |
| Traveler submitted for review (state → 1.5) | The requested reviewer(s) | "Traveler submitted for review: {traveler title}" | Who submitted, link to the traveler |
| Traveler approved (state → 2) | The traveler owner | "Traveler approved: {traveler title}" | Link to the traveler |
| Traveler frozen (state → 3) | The traveler owner | "Traveler frozen: {traveler title}" | Link to the traveler |
| Traveler archived (state → 4) | The traveler owner | "Traveler archived: {traveler title}" | Link to the traveler |

### User opt-in

The `User` model already has an `email` field and a `subscribe` boolean. Notifications are only sent when `subscribe` is `true` and `email` is non-empty. Users can toggle their subscription from their profile page.

### Integration points

> **To be defined** once the trigger events table is confirmed. Each event maps to a call to `sendNotification(...)` at the appropriate place in the relevant route or library function (e.g., `lib/review.js` for review events, the state-transition handlers for lifecycle events).

### Email content

Emails are HTML with an auto-generated plain-text fallback. Each message includes:
- A one-line description of the action.
- A direct URL to the document using `config.app.url` as the base.
- A footer with a link to the user's profile to unsubscribe.

---

## Drawbacks

- Adds two dependencies (`nodemailer`, `html-to-text`) and a new operational concern (SMTP relay reachability from the app host).
- Unauthenticated relay means delivery depends on the relay's host allowlist — moving the app host can silently break mail; `tools/check-smtp.js` exists to catch exactly this.
- Users with `subscribe: true` but an outdated `email` field will silently receive no mail.
- No retry logic — transient SMTP failures result in a missed notification with no recovery.

## Alternatives

- **Webhook / event bus**: more flexible but significantly more complex to operate.
- **In-app notification inbox**: avoids email dependency but requires building a new UI surface and polling or websockets.

## Unresolved Questions

Part 2 only:

- Which candidate trigger events are in scope for the first integration release?
- Should admins be able to send a broadcast notification to all subscribed users?
- Should there be per-event granularity in the subscription settings, or is a single on/off toggle sufficient?
- How should the app URL be configured for constructing deep links in emails?
