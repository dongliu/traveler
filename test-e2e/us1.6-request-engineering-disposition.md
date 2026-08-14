# Test E2E — User Story 1.6: Request Engineering Disposition (Superseded)

> **This user story has been removed from the spec.**
>
> User Story 1.6 ("Request Engineering Disposition") described a separate
> engineering disposition request email sent to the CE/CS after an initial
> notification to QA and management. The spec was restructured so that:
>
> - The CE/CS disposition request (Email 1, TO CE/CS, CC Originator) and the
>   QA Admin initial notification (Email 2, TO ncr-qa members, CC Originator)
>   are both sent as part of **User Story 1.5**.
> - There is no separate "initial notification to management before CE/CS
>   request" step — both emails are sent simultaneously upon NCR submission.
>
> All acceptance scenarios previously attributed to US 1.6 are covered by
> **User Story 1.5**. See `us1.5-send-initial-notification.md` for the
> current end-to-end test.

## Acceptance Scenario mapping to US 1.5

| Former US1.6 Acceptance Scenario | Covered by |
|----------------------------------|------------|
| AS1 — CE/CS receives email with link to NCR | US1.5 Acceptance Scenario 1 + steps 3–4 |
| AS2 — CE/CS accesses complete NCR via link | US1.5 Acceptance Scenario 3 + step 9 |
| AS3 — CE/CS assignment recorded with timestamp | US1.5 Acceptance Scenario 4 + step 11 |
| AS4 — Delegate assignment | **Deferred** — see spec "Future Work: CE/CS Delegate Assignment" |
| AS5 — Delegate has full disposition authority | **Deferred** |
