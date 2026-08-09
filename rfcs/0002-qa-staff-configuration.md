# RFC 0002: QA Staff Configuration for NCR Workflow

## Summary

For the NCR workflow, a designated group of users serve as QA staff. They receive notifications at key workflow steps and are the only users authorized to perform QA concurrence.

## Motivation

FR-008 requires the system to identify the correct QA staff automatically upon NCR submission, so that initial notification emails are routed to the right people. The spec leaves the lookup mechanism unspecified; this RFC defines how QA staff is configured and resolved.

## Requirements

1. The QA staff list must be retrieved from a well-known group stored in the database with the ID `ncr-qa`.
2. Only application admins can modify the QA staff list (add or remove members).
3. Any member of the `ncr-qa` group may perform the QA concurrence action on a dispositioned NCR.
4. All members of the `ncr-qa` group receive the initial NCR notification and the QA concurrence request notification.
5. If the `ncr-qa` group does not exist or has no members, NCR submission must fail with a clear configuration error rather than silently skipping notifications.

## Design

### Well-known group identity

The QA staff group is identified by the fixed `_id` string `ncr-qa` in the `Group` collection. This follows the existing convention in which group `_id` values are lowercase strings (matching `sAMAccountName.toLowerCase()` for AD-backed groups, or a lowercased name for locally created groups). The display name is `NCR-QA`.

No new model or schema changes are needed. The existing `Group` model (`model/user.js`) has all required fields:

```
_id:     'ncr-qa'          // well-known fixed identifier
name:    'NCR-QA'          // display name
members: [String → User]   // populated to obtain email addresses for notifications
```

### Group lookup

The NCR notification service resolves QA staff at two points in the workflow:

| Trigger | Event type | Recipients |
|---|---|---|
| NCR submitted | `notification.initial` | All `ncr-qa` members |
| CE/CS submits disposition | `notification.qa_notification` | All `ncr-qa` members |

At each point, the service calls:

```js
const group = await Group.findOne({ _id: 'ncr-qa' }).populate('members');
```

Each member's `_id`, `name`, and `email` are used to build the `recipients[]` array on the notification event. If the group is missing or empty, the operation aborts and returns an error before the NCR status transition is recorded.

### Authorization — QA concurrence

When a user submits QA concurrence (`PUT /ncr/:id/qa-concurrence`), the route checks that `req.user._id` appears in `ncr-qa.members`. No role field on the `User` document is needed; group membership is the sole gate. This keeps the authorization consistent with how the rest of the app manages access to shared resources.

### Group management

The `ncr-qa` group is managed entirely through the existing admin interface:

- **Create**: an admin creates the group once via the Groups tab on `/admin/` (or directly via `POST /groups/` with `{ name: 'ncr-qa' }`).
- **Add members**: via the existing `/groups/ncr-qa` page (the "Add User to Group" form).
- **Remove members**: via the existing "Remove Selected User(s)" button on the same page.

No new routes, views, or client scripts are required. The existing admin-only gate on all group mutation routes (`POST /groups/`, `PUT /groups/:id/addmember/:user`, `PUT /groups/:id/removeMembers`, `DELETE /groups/:id`) already satisfies requirement 2.

### Error handling

| Condition | Behavior |
|---|---|
| `ncr-qa` group not found | NCR submission returns 500 with message: `"NCR-QA group is not configured. Contact an administrator."` |
| `ncr-qa` group exists but has no members | Same error as above. |
| A member's email is missing | Log a warning and skip that recipient; do not block the workflow. |

## Implementation

No model or route changes are needed for group management. Changes are confined to the NCR notification service (not yet built) and the future QA concurrence route:

1. **NCR notification service** — when sending `notification.initial` and `notification.qa_notification`, resolve recipients by querying `Group.findOne({ _id: 'ncr-qa' }).populate('members')`. Validate the result before proceeding (see error handling above).

2. **QA concurrence route** — before accepting the concurrence action, verify `req.user._id` is in `ncr-qa.members`. Return 403 if the check fails.

3. **Bootstrap** — an admin must manually create the `ncr-qa` group and populate it before the NCR workflow is enabled. This is a one-time operational step, not a code change.

## Alternatives Considered

**Role on the User document** — adding an `ncr-qa` role string to `User.roles`. Rejected because it duplicates the group membership concept already present in the `Group` model and makes bulk membership changes harder (each user must be updated individually vs. editing one group document).

**Config file** — listing QA staff email addresses in a JSON config file. Rejected because it requires a server restart to change membership and offers no UI for admins to manage it.

## Open Questions

None. Resolved decisions:

- The `ncr-qa` group is created manually by an admin as a one-time bootstrap step. No automatic seeding.
- A single global QA staff group is sufficient. Per-project or per-WBS pools are out of scope.
