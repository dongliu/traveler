# ACL forms and form composition

This document covers two related concepts:

1. **ACL forms** — a new form type used to capture access-control-list or similar supplementary
   data that travels alongside a base procedure.
2. **Form composition** — combining one already-released base form with zero or more already-
   released ACL forms into a single released record, without re-authoring or re-releasing the
   base form itself.

---

## ACL forms

### What they are

An ACL form is a form template whose `formType` is set to `ACL`. It follows exactly the same
authoring and release lifecycle as any other form type: draft → submitted for review → released →
archived.

Once released, an ACL form is eligible to be attached to a base form during composition. It is
not used to start a traveler on its own.

### Creating an ACL form (admin only)

1. Open the **New Form** dialog (`/forms/new/`).
2. Under **Form type**, select **ACL**.
   (This option is only shown to users with the `admin` role.)
3. Enter a title and confirm.
4. Build the form content in the form builder as usual.
5. Submit the form for review and release it through the normal review workflow.

The released ACL form is now available as an attachment option in the compose action.

---

## Composing a released form

Composition creates a new released form by bundling the content of one already-released **base**
form with the content of one or more already-released **ACL** forms. It does not modify the
originals.

### Who can compose

Only users with the **Manager** or **Admin** role can perform the compose action.

### Step-by-step

1. Open the released base form you want to compose from (`/released-forms/<id>/`).
   The base form must be of type `normal` and must have status `released`. The **Compose**
   button appears in the action bar on the released-form detail page.

2. Click **Compose**.

3. The compose page (`/released-forms/<id>/compose`) shows three sections:

   - **Prior compositions** — any active `normal_acl` released forms that were already built
     from this same base. All rows are pre-selected. Rows you leave selected will be archived
     automatically when the new composition is saved, preventing stale duplicates from
     accumulating.
   - **Available ACL forms** — a table of all currently-released ACL forms. Check the box next
     to each ACL form you want to include.
   - **Composed form preview** — a live preview of the resulting form. ACL sections appear
     at the top; the base form always stays at the bottom. Drag the ACL sections to change
     their order.

4. Optionally edit the **Title** field to give the composed form a distinct name. It defaults to
   the base form's title.

5. Click **Compose** to save.

   - The page archives any prior compositions you left selected.
   - A new `normal_acl` released form is created and you are redirected to its detail page.

### Composition with zero ACL forms

You can compose with only the base form and no ACL forms selected. The result is a `normal_acl`
released form that renders and behaves identically to a traveler created from a plain base-only
release — no ACL section is shown to the person doing the work.

---

## The composed released form

The detail page of a `normal_acl` released form shows:

- **Type**: `normal_acl`
- **Version**: a string that encodes the base form's version and each attached ACL form's
  version, e.g. `base: 1, acl: 2, 3`.
- **Base form** section: the snapshotted base content.
- **ACL form sections**: one section per attached ACL form (in composition order), each labeled
  with the ACL form's title and version.

The content is an immutable snapshot taken at the moment of composition. Releasing a new version
of the base or any ACL form later does not change existing composed released forms.

---

## Using a composed form in a traveler

Creating a traveler from a `normal_acl` released form works exactly like any other released form.

When the traveler is opened, the ACL sections appear **before** the base form's content, in the
order they were arranged during composition. Each ACL field is editable and its value is saved as
part of the traveler's record, just like any base form field.

---

## Duplicate prevention

The system identifies compositions by a **composition key** derived from the underlying form ids
of the base and ACL forms (not the released-form ids). Two composition attempts are considered
duplicates when they reference the same base form and the same set of ACL forms, regardless of
selection order.

If an active released form already exists with the same title and the same composition key, the
new composition is rejected with an error identifying the existing record. Archive the prior
composition (or select it in the Prior compositions table before saving) to allow a replacement.

---

## Constraints and error conditions

| Condition | Result |
|---|---|
| Base form is not type `normal` | Request rejected with `400` |
| Base form is not released | Request rejected with `400` |
| An ACL form id is not found | Request rejected with `400` |
| A selected attachment is not type `ACL` or is not released | Request rejected with `400` |
| The base form is also listed as an ACL attachment | Request rejected with `400` |
| Duplicate ACL form ids in the request | Silently de-duplicated before processing |
| Input field names clash between any two forms in the composition | Request rejected with `400` listing the colliding names |
| An active composition with the same title and key already exists | Request rejected with `400` identifying the existing record |
