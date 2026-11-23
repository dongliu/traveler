# Data Model: Admin Traveler Unarchive

## `Traveler` (`model/traveler.js`)

### New field

| Field | Type | Default | Notes |
|---|---|---|---|
| `statusBeforeArchive` | `Number` | *(none — absent by default)* | Set only when `status` transitions to `4`; holds the status the traveler held immediately beforehand (always one of `0`, `1`, `2` — the only statuses from which `4` is reachable). Read once by `unarchiveTraveler` and cleared (`undefined`) afterward. Absent for every traveler archived before this feature shipped, and absent again for any traveler currently *not* archived. |

Lifecycle:

```
status --(-> 4, from 0/1/2)--> statusBeforeArchive := the status just left
status === 4, statusBeforeArchive set   --(unarchive)-->  status := statusBeforeArchive; statusBeforeArchive := undefined
status === 4, statusBeforeArchive absent --(unarchive)--> status := 1 (Active); statusBeforeArchive stays absent
```

No other schema change. `Traveler` is **not** wired into `model/history.js`'s `addHistory` plugin — see research.md D4 for why a general status-change audit trail was considered and deliberately not added; `statusBeforeArchive` alone fully answers the one question this feature needs answered.

### Status enumeration (unchanged)

| Value | Label |
|---|---|
| `0` | initialized |
| `1` | active |
| `1.5` | submitted for completion |
| `2` | completed |
| `3` | frozen |
| `4` | archived |

### State transitions

`model/traveler.js`'s existing `stateTransition` array is **unchanged**:

```
0   -> [1, 4]
1   -> [1.5, 3, 4]
1.5 -> [1, 2]
2   -> [4, 1]
3   -> [1]
```

This feature adds exactly one new path, deliberately kept **outside** this table (see research.md D3) because it has its own single rule (admin-only, no client-supplied destination) rather than the generic route's rules:

```
4 -> one of {0, 1, 2}   (= statusBeforeArchive, or 1 if absent)
```

## No other entities

No new collection, no change to `History`, `Binder`, `Review`, `Share`, or any other model. `updateBinderProgress` (`model/traveler.js`'s existing `post('save')` hook, keyed on `modifiedPaths.indexOf('status')`) continues to fire exactly as it does today for every status change, including the new unarchive transition — it is unaffected by this feature either way, since nothing here changes how `Traveler` documents are saved.
