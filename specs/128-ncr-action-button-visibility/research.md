# Research: Reposition and Permission-Gate the NCR Next-Action Button

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-24

## R1 — No route change needed; the template already has what it needs

**Decision**: Both routes that render `views/ncr-detail-body.jade` —
`GET /ncrs/:id` and `GET /ncrs/:id/fragment` (`routes/ncr-view.js`) —
already pass `{ ncr, isQa }`, where `ncr` is the full lean NCR document
(including `ce_cs_id`, `additional_approvers`, `originator_id`,
`originator_designate_id`) and `isQa` is already computed via
`isQaStaffMember(req.session.userid)`. The current viewer's own id is
already available to every view as `locals.userid`, set globally by the
auth middleware (`lib/auth/ldap.js`) on every authenticated request — the
same template already reads it today (`locals.userid === ncr.originator_id`,
line 1's `canManageApprovers`). FR-003 through FR-006's four checks are
therefore pure template-local boolean expressions; nothing new needs to
be queried, computed, or passed down from either route.

**Rationale**: Minimal surface area for a view-only fix — no risk of a
route change affecting the dashboard, the live-status poll, or any other
consumer of `routes/ncr-view.js`.

**Alternative considered**: Compute the four boolens server-side in
`routes/ncr-view.js` and pass them down as locals (`canCreateDisposition`,
`canConcur`, `canApprove`, `canClose`), mirroring how `isAssignedCeCs` is
already computed server-side for the *disposition* page. Rejected: that
page needs the check to decide between showing a form and a warning
banner — a page-level branch. This feature only needs a boolean to decide
whether to print one `<a>` tag, with all the source data already on
hand in the template; adding a route-level computation would be the same
logic in two places for no behavioral difference.

## R2 — Each boolean mirrors the service layer exactly, not re-derived

**Decision**: Each of the four `can*` booleans is written to match,
field-for-field, the authorization `lib/ncr-service.js` already enforces
when that action is actually submitted:

| Button | Status required | Template check | Mirrors |
|---|---|---|---|
| Create Disposition | `Submitted` | `ncr.ce_cs_id === locals.userid` | `submitDisposition`: `if (ncr.ce_cs_id !== user.id) throw 403` |
| QA Concurrence | `Dispositioned` | `isQa` | `submitConcurrence`: `if (!await isQaStaffMember(user.id)) throw 403` |
| Approve / Return | `Approval Requested` | `ncr.additional_approvers.some(a => a.approver_id === locals.userid)` | `submitApproval`: `if (!ncr.additional_approvers.find(a => a.approver_id === user.id)) throw 403` |
| Close NCR | `Final Approval` | `locals.userid === ncr.originator_id \|\| locals.userid === ncr.originator_designate_id` | `closeNcr`: `if (ncr.originator_id !== user.id && ncr.originator_designate_id !== user.id) throw 403` |

**Rationale**: FR-008 — a viewer who sees the button must always be
someone who can actually complete the action if they click it. None of
these four actions has a broader admin/manager override in
`lib/ncr-service.js` today (confirmed by reading each function), so none
is added here either — inventing one would show the button to people who
would still be refused by the real endpoint.

**Alternative considered**: A single generic "can I act on this NCR"
check reusable across statuses. Rejected: the four roles (assigned CE/CS,
QA group membership, designated approver, Originator/Designate) are
genuinely different relationships with no common shape to generalize —
forcing them into one shared helper would be more complex than four
direct, independently-readable boolean expressions, for a block of UI
that only ever evaluates one of them at a time (an NCR has exactly one
status, so at most one `can*` is ever relevant).

## R3 — Where the button block moves to

**Decision**: The repositioned block goes in its own `.row-fluid > .span12`
row, left-aligned (plain `<a class="btn ...">`, no `.text-right`),
inserted immediately before the existing `.row-fluid > .span12 > fieldset`
that holds Event Timeline — matching that section's own row/column
structure (so it lines up visually with everything else on the page)
rather than introducing a new column width or a new wrapping convention.

**Rationale**: FR-001's "directly above Event Timeline, left-aligned" is
satisfied exactly by insertion order and by dropping `.text-right`/`.span4`
in favor of `.span12`'s default left alignment — no new CSS needed.
