# Data Model: Form Review Request Email Notification

## Entity: Review (`model/review.js`)

The `review` schema is attached to a host document (today only `Form`, via `form.plugin(addReview)` in `model/form.js`) as `__review`. It already has `policy`, `reviewRequests`, and `reviewResults`. This feature adds one new sub-schema and array.

### New Sub-Schema: `reviewNotification`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|--------------|
| `recipient` | String | Yes | — | Email address the notification was attempted to |
| `sentOn` | Date | Yes | `Date.now()` | When the attempt was made |
| `success` | Boolean | Yes | — | Whether the mail relay accepted the message |
| `type` | String | No | `'request'` | Which notification template this was (only `'request'` exists today; leaves room for a future `'result'` notification without a schema change) |

### Schema Change

Add to the `review` schema definition, alongside `reviewRequests`/`reviewResults`:

```js
const reviewNotification = new Schema({
  recipient: { type: String, required: true },
  sentOn: { type: Date, required: true, default: Date.now },
  success: { type: Boolean, required: true },
  type: { type: String, default: 'request' },
});

const review = new Schema({
  policy: { /* unchanged */ },
  reviewRequests: [reviewRequest],
  reviewResults: [reviewResult],
  reviewNotifications: [reviewNotification],   // NEW
});
```

### New Method: `addReviewNotification`

Parallel to the existing `addReviewResult` method added by the `addReview(schema)` mixin:

```js
schema.methods.addReviewNotification = async function(recipient, success) {
  const doc = this;
  doc.__review.reviewNotifications.push({ recipient, success });
  return doc.save();
};
```

Called from `lib/review.js`'s `addReviewRequest`, once per notification attempt, regardless of whether the send succeeded.

### Exposure (no route change required)

`GET /forms/:id/review/json` (`routes/form.js`) already returns `form.__review` verbatim. Once `reviewNotifications` exists on the schema, it appears in that response automatically for anyone already permitted to call that route (`reqUtils.isOwnerMw('id')`).

---

## Entity: EmailConfig (`config/email.json`, new dedicated config file)

Replaces five keys currently in `app.json`/`app_change.json`, plus one new key for the disclaimer.

| Field | Type | Required | Moved From | Description |
|-------|------|----------|------------|--------------|
| `smtp_host` | String | Yes | `app.json` | Outgoing mail relay host |
| `smtp_port` | Number | Yes | `app.json` | Outgoing mail relay port |
| `smtp_ssl` | Boolean | Yes | `app.json` | Use implicit TLS |
| `smtp_tls` | Boolean | Yes | `app.json` | Use STARTTLS |
| `notification_email_address` | String | Yes | `app.json` | The "from" address for all outgoing notifications |
| `disclaimer` | String | Yes | *(new)* | Standard disclaimer text appended to every outgoing notification email (the `email-disclaimer` placeholder in `specs/email.md`) |

Loaded as `module.exports.email` in `config/config.js`, required (not optional) — the application fails to start if `email.json` is missing, same as `app.json`/`ad.json` today.

**`app.json`/`app_change.json` change**: remove `smtp_host`, `smtp_port`, `smtp_ssl`, `smtp_tls`, `notification_email_address` — these five keys no longer exist there.

---

## Entity: User (`model/user.js`) — No Schema Change

No new fields. This feature changes *when* a `User` document is created (from `lib/review.js`'s `addReviewRequest`, when a directory identity has none yet), not its shape. The created document uses the existing fields exactly as `storeUser` in `routes/user.js` already does for the admin-driven "add user" flow:

```js
new User({
  _id: adResult.sAMAccountName.toLowerCase(), // or the configured uid attribute, per ad.defaultKeys
  name: adResult.displayName,
  email: adResult.mail,
  roles: [],            // deliberately empty — Reviewer role is still a separate admin action
});
```

---

## Relationships

```
Form.__review (Review)
  ├─ reviewRequests[]        (existing — who was asked)
  ├─ reviewResults[]         (existing — what they decided)
  └─ reviewNotifications[]   (NEW — who was emailed, when, and whether it succeeded)

User (reviewer)
  └─ created automatically, from AD data, the first time its uid
     appears in a reviewRequest with no existing User document —
     roles: [] until an administrator grants Reviewer separately

EmailConfig (config/email.json)
  └─ consumed by lib/email.js (connection settings, "from" address)
     and by lib/review.js (disclaimer text appended to the body)
```

## Validation Rules

- `reviewNotification.recipient` and `.success` are always set together — there is no "pending" notification state; an attempt is recorded only after it resolves (sent or failed).
- Auto-created `User` documents from AD always have `roles: []`; nothing in this feature ever pushes a role onto that array.
- The AD lookup for auto-creation must resolve to exactly one directory entry; zero or multiple matches never create a `User` document (same rejection as today for an unrecognized reviewer id).
