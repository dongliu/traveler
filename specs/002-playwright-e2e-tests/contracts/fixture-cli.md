# Contract: Fixture CLI

**Feature**: `002-playwright-e2e-tests` | **Consumers**: Playwright test/fixture code only (internal, not a public interface)

The fixture CLI is a Node script added at `e2e/fixtures/cli.js`, invoked from
inside Playwright test code via:

```
docker compose exec -T web node e2e/fixtures/cli.js <command> '<json-args>'
```

It connects to MongoDB using the exact same bootstrap `app.js` uses
(`docker/mongo.json` via `TRAVELER_CONFIG_REL_PATH=docker`, already set as an
environment variable on the `web` service in `docker-compose.yml`), requires
the app's own `model/*.js` Mongoose schemas directly, performs one operation,
prints one line of JSON, and exits.

## Invocation contract

- **stdin**: unused.
- **argv[2]**: the command name (see table below).
- **argv[3]**: a single JSON-encoded string of command arguments.
- **stdout on success**: exactly one line, `{"ok": true, ...}` — command-specific fields follow.
- **stderr + exit code 1 on failure**: exactly one line, `{"ok": false, "error": "<message>"}`.
- **Idempotency**: every command MUST be safe to call twice with the same
  arguments (e.g. `grant-role` on an already-granted role is a no-op success,
  not an error) — scenarios may re-provision a fixture without first checking
  whether it already exists.

## Commands

### `grant-role`

Grants a role to a user by adding to `users.<userId>.roles` (per
`model/user.js`'s `user.roles: [String]`).

- Args: `{ "userId": "<user _id>", "role": "manager" | "qa_staff" | ... }`
- Output: `{ "ok": true, "userId": "...", "roles": ["..."] }` (the user's full roles array after the grant)

### `reset-user-roles`

Resets a user's `roles` array to empty (cleanup between scenarios, or to set
up a "does not have this role" precondition for access-control checks).

- Args: `{ "userId": "<user _id>" }`
- Output: `{ "ok": true, "userId": "...", "roles": [] }`

### `add-group-member`

Adds a user id to a `Group` document's `members` array (per `model/user.js`'s
`group` schema) — used for `ncr-qa` QA Admin membership.

- Args: `{ "groupId": "ncr-qa", "userId": "<user _id>" }`
- Output: `{ "ok": true, "groupId": "ncr-qa", "members": ["..."] }`

### `remove-group-member`

Removes a user id from a `Group` document's `members` array — used to
provision the "ncr-qa group is empty" failure-path scenario (spec User Story
1, Acceptance Scenario 6) and general cleanup.

- Args: `{ "groupId": "ncr-qa", "userId": "<user _id>" }` (userId omitted → clears all members)
- Output: `{ "ok": true, "groupId": "ncr-qa", "members": [] }`

### `set-ce-cs`

Sets `ce_cs_id` (and optionally `ce_cs_name`) directly on an NCR document —
the creation form has no real user lookup for this field, so disposition
scenarios need it set directly (per `model/ncr.js`'s `ce_cs_id: String`).

- Args: `{ "ncrId": "<ncr _id>", "ceCsId": "<user _id>", "ceCsName": "<display name>" }`
- Output: `{ "ok": true, "ncrId": "...", "ce_cs_id": "..." }`

### `backdate-ncr`

Sets an NCR's `creation_timestamp` (per `model/ncr.js`) into the past, for
aging/escalation dashboard checks.

- Args: `{ "ncrId": "<ncr _id>", "daysAgo": 31 }`
- Output: `{ "ok": true, "ncrId": "...", "creation_timestamp": "<ISO date>" }`

### `create-traveler-linked-ncr`

Creates an NCR directly (bypassing the creation-page UI, which exposes no
Traveler-link fields) with `traveler_link.initiated_from_traveler = true`, for
the Traveler sign-off closure check (spec User Story 2, Acceptance Scenario
6). Accepts the same field set as the real creation API/form, plus the
Traveler link fields.

- Args: `{ "ncrData": { ...same shape as the NCR creation form fields... }, "travelerId": "<id>", "stepNumber": 3 }`
- Output: `{ "ok": true, "ncrId": "...", "ncr_number": "..." }`

### `get-user`

Reads back a user document's `roles` array — used to assert `grant-role`/
`reset-user-roles` produced the expected state (spec User Story 3,
Acceptance Scenario 1).

- Args: `{ "userId": "<user _id>" }`
- Output: `{ "ok": true, "userId": "...", "roles": ["..."] }`

### `get-group`

Reads back a `Group` document's `members` array — used to assert
`add-group-member`/`remove-group-member` produced the expected state (spec
User Story 3, Acceptance Scenario 1; User Story 1, Acceptance Scenario 6).

- Args: `{ "groupId": "ncr-qa" }`
- Output: `{ "ok": true, "groupId": "...", "members": ["..."] }`

### `get-ncr`

Reads back an NCR document (or a projected subset) for assertions that need
to inspect stored data beyond what the UI renders — e.g. `events[]` entries'
`recipients[]`/`cc[]` delivery status and timestamps (per `model/ncr.js`'s
`NcrEventSchema`).

- Args: `{ "ncrId": "<ncr _id>", "fields": ["events", "status", "disposition"] }` (`fields` omitted → full document)
- Output: `{ "ok": true, "ncr": { ...requested fields... } }`

## Non-goals

This CLI is test-only tooling, never imported by or reachable from any
production route. It performs direct Mongoose writes that bypass the app's
own service-layer validation/state-machine checks by design (it is
*provisioning preconditions*, not exercising the app's own business logic —
the business logic itself is what the Playwright browser actions exercise).
