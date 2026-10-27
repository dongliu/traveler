# API Contracts: Form Review Request Email Notification

Both endpoints are on the web-app server (session-authenticated). Both already exist; this feature changes their behavior/response, not their URL, method, or authorization.

---

## 1. Add a Review Request (Modified)

**`POST /forms/:id/review/requests`** *(existing endpoint — `reqUtils.isOwnerMw('id')`, status `[0.5]` only)*

### Request Body (unchanged)

```json
{ "uid": "jdoe", "name": "Jane Doe" }
```

### Behavior Changes

1. If `uid` has no existing `User` document, the system now looks the identity up in the organization directory and creates a minimal account (`name`, `email`, `roles: []`) instead of immediately rejecting. The directory lookup, not the request body, is the source of the stored name/email.
2. The existing `if (!reviewer.roles.includes(Reviewer))` check is unaffected and runs against the (possibly just-created) account — a brand-new reviewer still gets rejected here until an administrator grants the Reviewer role, same wording as today: `User ${name} needs to have reviewer role in order to review.`
3. On success (`doc.requestReview(...)` resolves), the system attempts to send the review-request notification email (per `specs/email.md`) to the reviewer, cc'ing the form owner, and records the attempt (see Finding 5 / data-model.md `reviewNotifications`) regardless of whether the send succeeded.

### Response (unchanged shape; new rejection case)

- `201 Created` — `review request added for user ${name} .` (unchanged; notification attempt happens after this is decided, never blocks it)
- `400 Bad Request`:
  - Directory identity not found or ambiguous (replaces today's "please add user id ... to etraveler user list" message for the *not-found* case specifically — ambiguous/not-found in the directory still can't proceed)
  - Account exists (pre-existing or just auto-created) but lacks the Reviewer role — unchanged message
- `500 Internal Server Error` — unchanged (db/save failure)

### Explicitly NOT Changed

- A notification send failure (SMTP unreachable, etc.) never turns a `201` into a `4xx`/`5xx` — it is swallowed exactly as `lib/email.js`'s `sendNotification` already does, and only affects the `success` flag recorded in `reviewNotifications`.

---

## 2. Read Review State (Modified Response Shape)

**`GET /forms/:id/review/json`** *(existing endpoint — `reqUtils.isOwnerMw('id')`, no status restriction)*

### Response

Returns `form.__review` verbatim, unchanged route code. The object now includes the new array alongside the existing ones:

```json
{
  "policy": "all",
  "reviewRequests": [ { "_id": "jdoe", "requestedOn": "...", "requestedBy": "..." } ],
  "reviewResults": [],
  "reviewNotifications": [
    { "recipient": "jdoe@example.org", "sentOn": "2026-10-25T...", "success": true, "type": "request" }
  ]
}
```

No new endpoint was added to expose this — it rides on the existing, already-gated response.
