# Data Model: WBS Hierarchical Notification Lookup

## Overview

No schema changes. This feature adds one pure function and wires its result
into two existing notification call sites. Nothing new is persisted.

## Function: `resolveWbsContact(wbsNumber)`

**Location**: `lib/wbs-notification-service.js` (extends the module 005
already created)

**Purpose**: Given a WBS number string, return the WBS Notification Registry
entry that governs it — the exact match if one exists, otherwise the nearest
registered ancestor, otherwise `null`.

```javascript
async function resolveWbsContact(wbsNumber) {
  if (!wbsNumber) return null;
  const trimmed = String(wbsNumber).trim();
  if (!trimmed) return null;

  const candidates = [];
  let current = trimmed;
  while (current) {
    candidates.push(current);
    const lastDot = current.lastIndexOf('.');
    if (lastDot === -1) break;
    current = current.slice(0, lastDot);
  }
  // candidates: [wbsNumber, immediate parent, grandparent, ..., root segment]
  // — nearest-to-farthest order, matching the "nearest ancestor wins" rule.

  const matches = await WbsNotification.find({ wbs_number: { $in: candidates } }).lean();
  if (!matches.length) return null;

  const byWbsNumber = {};
  matches.forEach(m => { byWbsNumber[m.wbs_number] = m; });

  for (const candidate of candidates) {
    if (byWbsNumber[candidate]) return byWbsNumber[candidate];
  }
  return null;
}
```

**Validation rules**: None — this function does not validate `wbsNumber`'s
format (that already happens, or doesn't, wherever the NCR's `wbs_number`
was originally captured; this feature only reads it). An `undefined`, `null`,
or empty `wbsNumber` returns `null` (no match, not an error).

**Behavior guarantees** (per spec.md FR-001/FR-002):
- Exact match always wins over any ancestor match.
- Among ancestor matches, the nearest (most segments) wins over any more
  distant one.
- A registry entry with MORE segments than `wbsNumber` (a descendant) is
  never a candidate — it is structurally excluded, since `candidates` only
  ever contains `wbsNumber` itself and prefixes of it, never anything
  longer.

## Modified Function: `createNcr(data, user, webBaseUrl)`

**Location**: `lib/ncr-service.js`

**Change**: After resolving `qaEmails` (existing code) and before calling
`sendInitialNotification`, resolve the WBS contact and append its email if
found:

```javascript
const wbsMatch = await resolveWbsContact(data.wbs_number);
const initialRecipients = wbsMatch ? [...qaEmails, wbsMatch.notification_email] : qaEmails;

const { results: initialResults, cc: initialCc } =
  await sendInitialNotification(ncr, initialRecipients, ncrUrl, user.email);
appendNotificationEvent(ncr, 'notification.initial', initialResults, initialCc);

ncr._wbsNotificationMatched = !!wbsMatch;   // non-schema property, see research.md Decision 3
```

**Return contract**: Unchanged — still returns the `ncr` Mongoose document
directly (with the transient `_wbsNotificationMatched` property attached,
which is never persisted since it is not a declared schema path).

## Modified Function: `closeNcr(ncrId, data, user)`

**Location**: `lib/ncr-service.js`

**Change**: After building the existing `emails` array (from
`recipientIds`/`allQa`/`ppmUsers`) and before calling
`sendFinalDistribution`, resolve the WBS contact again (registry state may
have changed since submission — see spec.md Edge Cases) and append its email
if found:

```javascript
const wbsMatch = await resolveWbsContact(ncr.wbs_number);
if (wbsMatch) emails.push(wbsMatch.notification_email);

if (emails.length > 0) {
  const results = await sendFinalDistribution(ncr, emails);
  appendNotificationEvent(ncr, 'notification.final_distribution', results);
  ncr.closure_record.distribution_notification_timestamp = new Date();
}
```

**Return contract**: Unchanged.

## Response Shape Addition: `POST /api/ncrs`

**Location**: `routes/ncr.js`

The existing 201 response gains one new top-level field:

```javascript
{
  success: true,
  ncr: { /* unchanged */ },
  wbs_notification_matched: boolean,   // NEW — read from ncr._wbsNotificationMatched
  message: 'NCR created successfully. Initial notification emails sent.',
}
```

No other endpoint's response shape changes.
