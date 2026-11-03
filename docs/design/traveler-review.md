# Traveler Review Feature — UX Design Doc

**Status**: Draft

**Owner**: _TBD_

This is a user-experience design doc: it describes who does what, in what order, and what they
see at each step. It intentionally stays out of data models, routes, and code — see
[References](#references) at the bottom for the existing, related implementation.

---

## Summary

This feature adds an explicit review step to completing a traveler: the traveler owner names one
or more reviewers, each reviewer responds with an approval or a request for changes, and everyone
involved is notified by email as the review moves forward.

## Motivation

Forms already have a full review workflow: an owner requests specific people as reviewers, each
reviewer approves or asks for changes, and (as of the recent email-notification work) the
reviewer is emailed and the attempt is recorded on the form.

Travelers have no equivalent today. A traveler submitted for completion is approved or sent back
by **any** admin or manager — whoever happens to open it. There is no way to name specific
reviewers, no per-reviewer record of who was asked or what they decided, and no notification when
a traveler needs someone's attention.

This creates two concrete problems:

1. **No clear ownership.** Nothing says who is actually supposed to review a given traveler —
   only that some admin or manager eventually will.
2. **No way to call attention to a pending review.** With many users holding the manager or
   admin role, a traveler can sit "submitted for completion" indefinitely because everyone
   assumes someone else will get to it.

## Goals

1. When submitting a traveler for completion, its owner can choose specific people as reviewers
   (whether more than one is allowed is still open — see Open Question 4).
2. The traveler owner and the reviewers are notified by email — when a review is requested, and
   again when a reviewer responds.

## Non-Goals

1. Changing who can hold the Manager/Admin role, or how those roles are granted.
2. A configurable approval policy (e.g., "any one reviewer" vs. "all reviewers must approve").
   Forms have an unused `policy` setting for this, but no UI ever exposes it — reviewers must
   unanimously approve in practice today, and this doc assumes the traveler feature starts the
   same way unless decided otherwise.
3. Reviewing anything other than a traveler's filled-in data (e.g., there's no review step for the
   released form it was created from — that already has its own, separate review).

## People Involved

1. **Traveler owner** — created the traveler, or was later made its owner. Decides when it's
   ready for completion and who should review it.
2. **Reviewer** — someone the owner names. Reads the traveler's filled-in data and either
   approves it or sends it back with comments.
3. **Admin / Manager** — today, this is the *only* role that can approve a traveler. Their
   continued role once named reviewers exist is an open question below.

## Current Experience (Today, Without This Feature)

Setting expectations for what changes:

1. A traveler owner (or admin/manager) clicks **Submit for completion**. The traveler moves to
   "submitted for completion," with no reviewer named anywhere.
2. From that point, **any** admin or manager who opens the traveler sees two buttons: **Approve
   completion** and **More work**. Whoever gets to it first decides, without any record of why
   they were the one reviewing it.
3. Nobody is notified that the traveler is waiting. The owner finds out it was approved (or sent
   back) only by checking the traveler themselves.

For comparison, this is how the equivalent already works for **forms**, which this feature is
expected to feel like:

1. The form owner opens a **Reviewer list** page, searches for a person by name, and adds them
   as a reviewer. The page lists everyone currently requested, and the owner can remove someone
   before they've responded.
2. A named reviewer opens the form itself (not a separate page) and sees a simple panel: an
   **Approve** / **Rework** choice, a comment box, and a **Report** button.
3. Everyone who can see the form also sees a running list of who has reviewed it and what they
   said, including comments.
4. Once every requested reviewer has approved, the owner sees a note that the form is ready to
   release — but releasing it is still a separate, deliberate action the owner takes.
5. Emailing the reviewer when they're requested, and recording whether that email went out, is
   already built — the traveler feature would reuse that.

## Decisions Made So Far

1. **Submitting gates on picking reviewers.** The owner must pick at least one reviewer before
   the traveler actually moves to "submitted for completion" — the traveler stays in its current
   state until that's done. This is a deliberate departure from forms, where submitting for
   review and adding a reviewer are two independent actions, and a form can sit under review
   with no reviewer named at all.
2. **At least one reviewer is required.** Zero-reviewer submission (today's behavior) goes away.
3. **A reviewer sees the traveler read-only.** They cannot change any field while a traveler is
   under review; they can only record their decision and comment.
4. **The traveler auto-completes.** Once every requested reviewer approves, the traveler moves
   to "approved" on its own — nobody has to click a button. This is a deliberate departure from
   forms, where all-approved only unlocks the Release button for the owner to click. The owner is
   emailed that the traveler is now approved.

## Proposed User Flows

### Flow 1 — Owner requests reviewers

1. The owner clicks **Submit for completion**.
2. Before the traveler actually moves to "submitted for completion," the owner must pick at
   least one reviewer — the same person-search picker used elsewhere in the app. The traveler
   stays in its current state until this step is done.
3. Once at least one reviewer is picked, the traveler moves to "submitted for completion," and
   the owner sees the list of who's been asked, so it's clear who still needs to respond.
4. Each named reviewer receives an email: a plain description of what's being asked of them, a
   link straight to the traveler, and who requested it.

See Open Question 7 for what happens if the owner picks someone who isn't yet set up as a
reviewer.

### Flow 2 — Reviewer reviews the traveler

1. The reviewer follows the link in their email and lands on the traveler.
2. They see the traveler's filled-in data as **read-only** — they cannot change any field while
   reviewing.
3. They see a clear way to respond: approve, or send it back with a comment explaining what
   needs to change.
4. After responding, their decision appears in a visible history alongside anyone else's.

### Flow 3 — Owner (and other reviewers) see the outcome

1. When a reviewer responds, the owner is emailed with the result (approved / sent back) and any
   comment.
2. On the traveler itself, everyone who can see it sees the same running history of reviews that
   forms already show.
3. Once every requested reviewer has approved, the traveler **automatically** moves to
   "approved" — no separate click from the owner or an admin/manager is needed. The owner is
   emailed that the traveler is now approved.

### Flow 4 — A reviewer asks for changes

1. The reviewer picks "send back" (naming TBD — forms call this "Rework") and leaves a comment
   describing what needs to change.
2. The owner is emailed with the comment and gets back to work on the traveler.
3. What happens to the other, already-requested reviewers when this happens? See Open Question 6
   — the biggest behavioral decision in this doc.

## Notifications (What People Receive)

Four moments — the first three match the pattern already shipped for forms; the fourth is new,
since forms never complete themselves (travelers now auto-complete once every reviewer
approves):

| # | Moment | Who receives it | In plain terms |
|---|---|---|---|
| 1 | A reviewer is requested | That reviewer, cc the owner | "You've been asked to review traveler X — here's the link." |
| 2 | A reviewer approves | The owner, cc reviewer | "Reviewer Y approved traveler X." Any comment included. |
| 3 | A reviewer sends it back | The owner, cc reviewer | "Reviewer Y requested changes on traveler X," with their comment. |
| 4 | The last reviewer approves and the traveler auto-completes | The owner, cc all reviewers | "Traveler X has been approved by all reviewers and is now complete." |

Every email ends with the same standard disclaimer line already used for other notifications in
the app, so these feel consistent with everything else people get from the system.

## Open Questions

1. Does naming reviewers **replace** the current "any admin/manager can approve" behavior, or
   sit alongside it as a fallback/override? Sharpened by the traveler's auto-complete behavior
   (see Decisions above): once reviewers alone can finish a traveler, is there still a need for
   an admin/manager to approve it *before* all reviewers have responded, as an override?
2. Can the traveler's own owner also be one of its reviewers?
3. What happens to a reviewer who's already responded if the owner adds another reviewer
   afterward — do they get asked again once changes are made, or is their earlier response
   final?
4. Is there a maximum number of reviewers, or can the owner name more than one? This isn't just
   a UI detail — if the answer is "exactly one, always," then Open Question 3, Open Question 6,
   and the approval-policy Non-Goal (#2 above) all become moot, since there's never more than one
   reviewer's response to reconcile.
5. **Who is eligible to be named a reviewer?** Forms already have a separate `Reviewer` role
   (distinct from Manager/Admin) that any user can be granted, and a form reviewer must hold
   that role before their approval counts. Should traveler review work the same way — any user
   holding the Reviewer role is eligible — or should it stay restricted to users who already
   hold the Manager/Admin role, matching how traveler approval works today? (Related: Open
   Question 1, which asks whether admin/manager keep a blanket-approve power *alongside* named
   reviewers — this question is about who can *be* a named reviewer in the first place.)
6. **The biggest behavioral decision in this doc.** Today, when a form reviewer sends it back,
   *every* requested reviewer is cleared — including anyone who had already approved — and a
   fresh round of reviewers has to be requested from scratch once the owner resubmits. Does that
   make sense for travelers too, or is it too disruptive when a traveler might have several
   reviewers and only one of them had a problem? An alternative: only clear that one reviewer's
   request, and leave other reviewers' approvals standing.
7. What happens if the owner picks someone who isn't yet set up as a reviewer in the system? For
   forms, this used to be a dead end requiring an administrator to intervene by hand; it was
   recently improved so the person is set up automatically from the directory, though someone
   with admin access still has to grant them reviewer standing before the request goes through.
   Should travelers behave the same way? (Depends on the answer to Open Question 5 — "reviewer
   standing" there may mean the Reviewer role, or Manager/Admin, or something else.)

## References

Existing, related implementation this feature would most naturally build on:

1. [RFC 0005 — Email Notification](../../rfcs/0005-email-notification.md) — its "Traveler
   lifecycle" candidate table already sketched review-requested / review-result events for
   travelers.
2. `model/review.js` — the composable review mixin (`reviewRequests`, `reviewResults`,
   `reviewNotifications`), currently used only by forms.
3. `lib/review.js` / `routes/form.js`'s `/forms/:id/review/*` and `views/review.jade` — the
   existing form review workflow, its UI, and its recent email-notification extension.
4. `views/form-builder.jade` (the reviewer's approve/rework panel) and `views/traveler.jade`
   (the traveler page's current status buttons) — the two existing pages this feature would
   extend.
