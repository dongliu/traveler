# Test E2E — User Story 1.6: Request Engineering Disposition

**Spec reference**: `specs/001-ncr-workflow/spec.md`, "User Story 1.6 -
Request Engineering Disposition" (Priority: P1)
**Files under test**: `lib/ncr-service.js` (`createNcr`), `lib/ncr-email.js` (`sendDispositionRequest`)

> **Coverage note**: User Story 1.5 already exercises all three acceptance
> scenarios of this story. The engineering disposition request email to the
> CE/CS (AS1), the NCR detail page content accessible via the link (AS2), and
> the CE/CS assignment recorded with timestamp (AS3) are all verified in
> `us1.5-send-initial-notification.md` steps 5–9 and the Human Verification
> Checklist there. Run US1.5 first; if it passes, AS1–AS3 of US1.6 are
> considered covered.

> **Deferred — Delegate Assignment (AS4/AS5)**: The CE/CS delegate assignment
> feature is not implemented. Requirements for when and how a CE/CS may assign
> a delegate are pending clarification. See the spec's
> "Future Work: CE/CS Delegate Assignment" section. No test steps for delegate
> assignment are included here; this test file will be updated when requirements
> are resolved.

## What distinguishes US1.6 from US1.5

US1.5 verifies that **both** outbound emails (originator confirmation + CE/CS
disposition request) are sent as a side effect of NCR creation. US1.6 focuses
on the CE/CS perspective of that same disposition request: that the link in
the email gives the CE/CS full access to the NCR and that the assignment is
persisted correctly. In practice these overlap completely — running US1.5
covers US1.6 with no additional steps needed.

## Acceptance Scenario mapping to US1.5 steps

| US1.6 Acceptance Scenario | Covered by US1.5 step(s) |
|---------------------------|--------------------------|
| AS1 — CE/CS receives email with link | Steps 5–6 (MailHog second message, distinct from originator) |
| AS2 — CE/CS accesses complete NCR via link | Steps 8–9 (CE/CS email body + clickable link resolves to NCR detail) |
| AS3 — CE/CS assignment recorded with timestamp | Step 11 + checklist (events[] has `notification.disposition_request` with `ce_cs_id`, timestamp, delivery status) |
| AS4 — Delegate assignment | **Deferred** |
| AS5 — Delegate has full disposition authority | **Deferred** |

## Human Verification Checklist

These items are a subset of the US1.5 checklist, restated here for traceability:

- [ ] MailHog shows a disposition request email addressed to the CE/CS email
      designated at NCR creation (verified in US1.5 step 5).
- [ ] The CE/CS email body contains NCR summary fields and a URL link to the
      NCR detail page (verified in US1.5 step 8).
- [ ] The NCR link in the CE/CS email loads the correct NCR detail page
      (verified in US1.5 step 9).
- [ ] The `ncrs` document in mongo-express has `ce_cs_id` and `ce_cs_name`
      persisted, and `events[]` contains a `notification.disposition_request`
      event with recipient matching `ce_cs_id`/`ce_cs_email` and a
      `delivery_timestamp` (verified in US1.5 checklist).
- [ ] **Delegate (deferred)**: No UI control for delegate assignment exists on
      the NCR detail page, and no `ce_cs_delegate_id` field is present on the
      `ncrs` document. Flag any appearance of either as an unexpected
      implementation gap.
