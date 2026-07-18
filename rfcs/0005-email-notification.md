# RFC: Email Notification

## Summary

Send email notifications to users when significant events occur in the application — including but not limited to the review workflow — to keep relevant parties informed without requiring them to poll the UI.

## Status

Proposed.

## Motivation

Users currently have no way to learn about activity in the application without logging in and checking manually. This creates friction for time-sensitive workflows such as review approvals and traveler sign-offs, but the problem applies more broadly: any event where one user's action creates work or context for another user is a candidate for a notification.

## Detailed Design

### Trigger events

> Subject lines and body content are candidates to be confirmed.

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

### Email delivery

Uses `nodemailer` (same library as the `upton` branch) with `html-to-text` to auto-generate a plain-text fallback from the HTML body.

The implementation lives in `lib/email.js` and exports:

```js
sendNotification({ subject, recipients, text, html })
```

- `recipients` may be a single address string or an array.
- If only `html` is provided, `html-to-text` generates the `text` part automatically.
- The transport is initialized lazily on first use and pooled (`maxConnections: 2`).
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

For this deployment the SMTP backend is **Google Workspace**. The auth method is to be confirmed, but the two practical options are below.

#### Option A — OAuth2 with a service account (recommended)

Google's preferred server-to-server approach. No passwords stored; tokens are short-lived and automatically refreshed.

1. In Google Cloud Console, create a service account and download its JSON key file.
2. Enable the **Gmail API** for the project.
3. In the Google Workspace Admin console, grant the service account domain-wide delegation with the scope `https://www.googleapis.com/auth/gmail.send`.
4. Add the `googleapis` package and use the `google.auth.GoogleAuth` client to mint an OAuth2 access token, then pass it to nodemailer as an OAuth2 transport:

```js
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: config.app.google_service_account_key,
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  clientOptions: { subject: config.app.notification_email_address },
});

const accessToken = await auth.getAccessToken();

transport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: config.app.notification_email_address,
    accessToken,
  },
});
```

New config keys needed in `app.json`:

| Key | Description |
|---|---|
| `google_service_account_key` | Path to the service account JSON key file |

#### Option B — App password over SMTP (simpler, no extra package)

Suitable if OAuth2 setup is not available. Requires 2-Step Verification on the sending account and an app password generated in the Google account settings. Uses the existing SMTP transport shape in `lib/email.js` with no code changes:

```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_ssl": false,
  "smtp_tls": true,
  "notification_email_address": "traveler-noreply@example.com",
  "smtp_user": "traveler-noreply@example.com",
  "smtp_pass": "<app-password>"
}
```

The `initTransport` call in `lib/email.js` would need to pass `auth: { user, pass }` when these keys are present.

New config keys needed in `app.json`:

| Key | Description |
|---|---|
| `smtp_user` | SMTP login username (the sending address) |
| `smtp_pass` | App password generated in Google account settings |

> **To be confirmed.** Choose Option A or Option B and remove the other before implementation.

### Integration points

> **To be defined.** Integration points will be identified once the trigger events table is complete. Each event maps to a call to `sendNotification(...)` at the appropriate place in the relevant route or library function.

### Email content

Emails are HTML with an auto-generated plain-text fallback. Each message includes:
- A one-line description of the action.
- A direct URL to the document using `config.app.url` as the base.
- A footer with a link to the user's profile to unsubscribe.

## Drawbacks

- Adds an external dependency (`nodemailer`, `html-to-text`) and a new operational concern (SMTP/Google Workspace configuration).
- Users with `subscribe: true` but an outdated `email` field will silently receive no mail.
- No retry logic — transient SMTP failures result in a missed notification with no recovery.

## Alternatives

- **Webhook / event bus**: more flexible but significantly more complex to operate.
- **In-app notification inbox**: avoids email dependency but requires building a new UI surface and polling or websockets.

## Unresolved Questions

- Should admins be able to send a broadcast notification to all subscribed users?
- Should there be per-event granularity in the subscription settings, or is a single on/off toggle sufficient?
- How should the app URL be configured for constructing deep links in emails?
