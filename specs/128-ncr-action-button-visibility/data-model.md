# Data Model: Reposition and Permission-Gate the NCR Next-Action Button

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-24

No new MongoDB field, no schema change, no new endpoint. The only new
shape is four template-local booleans, declared once at the top of
`views/ncr-detail-body.jade` alongside the existing `canManageApprovers`
(line 1), each read-only and derived entirely from data the template
already has.

## The four `can*` booleans

| Name | Condition | True only for |
|---|---|---|
| `canCreateDisposition` | `ncr.status === 'Submitted' && ncr.ce_cs_id === locals.userid` | The person assigned as this NCR's CE/CS |
| `canConcur` | `ncr.status === 'Dispositioned' && isQa` | A member of the QA staff group |
| `canApprove` | `ncr.status === 'Approval Requested' && ncr.additional_approvers.some(a => a.approver_id === locals.userid)` | A person designated as an approver on this NCR |
| `canClose` | `ncr.status === 'Final Approval' && (locals.userid === ncr.originator_id \|\| locals.userid === ncr.originator_designate_id)` | This NCR's Originator or their assigned Designate |

Exactly one, or none, of these four is ever true for a given NCR/viewer
pair — an NCR has one status at a time, and only one boolean's status
guard can match.

## Button block (new shape, same labels/links as today)

| Boolean | Label | Link (unchanged) | Bootstrap class (unchanged) |
|---|---|---|---|
| `canCreateDisposition` | Create Disposition | `#{prefix}/ncrs/#{ncr._id}/disposition` | `btn-primary` |
| `canConcur` | QA Concurrence | `#{prefix}/ncrs/#{ncr._id}/concurrence` | `btn-success` |
| `canApprove` | Approve / Return | `#{prefix}/ncrs/#{ncr._id}/approve` | `btn-warning` |
| `canClose` | Close NCR | `#{prefix}/ncrs/#{ncr._id}/close` | `btn-danger` |

The block itself (`.row-fluid > .span12`, left-aligned) only renders at
all when at least one of the four booleans is true — when none is (no
action offered for the current status, or the viewer isn't authorized for
the one that is), nothing is shown, matching FR-007.

## Inputs this feature depends on (already provided, unchanged)

| Input | Source | Already passed by |
|---|---|---|
| `ncr` (incl. `status`, `ce_cs_id`, `additional_approvers`, `originator_id`, `originator_designate_id`) | `Ncr.findById(id).lean()` | `routes/ncr-view.js`'s `GET /ncrs/:id` and `GET /ncrs/:id/fragment` |
| `isQa` | `isQaStaffMember(req.session.userid)` | Same two routes |
| `locals.userid` | Set globally per authenticated request | `lib/auth/ldap.js` (every view, not route-specific) |
