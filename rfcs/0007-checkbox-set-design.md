# RFC: Checkbox Set Redesign

## Summary

This RFC proposes an improved editing experience for checkbox sets in the form
builder — specifically, letting the user reorder an existing checkbox option
within the set.

## Motivation

Once a checkbox option has been added to a checkbox set, its position in the
list is fixed by insertion order. Today, moving an option requires removing it
and re-adding it in the right spot, which loses the option's existing text and
user key and is tedious for anything but a one-item list. Users need a direct
way to move an existing option up or down.

## Detailed Design

### Current behavior

In `public/javascripts/lib/checkbox-set.js` (`binding_checkbox_set_events`),
hovering over a `.checkbox-in-set` line — while the containing checkbox set is
in edit mode — appends (or re-shows) a `.checkbox-set-buttons` block below the
line, rendered from `inputview/checkbox_set_button.jade`:

```jade
.checkbox-set-buttons
  .btn-group
    a.btn.btn-info(title='edit the checkbox') Edit
    a.btn.btn-warning(title='remove the checkbox') Remove
```

Moving the mouse off the line hides the buttons again (`mouseleave`), and
clicking Edit or Remove acts on the closest `.checkbox-in-set`.

### New behavior

Replace the hover-reveal block below the line with a button group pinned to
the right side of each `.checkbox-in-set` line, with four actions: **Edit**,
**Remove**, **Move up**, **Move down**.

- The buttons stay hover-revealed, same as today — only their position and
  count change.
- `.checkbox-in-set` becomes a flex row: `.controls` (the checkbox input and
  its label text) grows to fill the available width, and
  `.checkbox-set-buttons` is pinned to the right with a fixed width. When the
  checkbox text is long, the label wraps onto additional lines instead of
  pushing the buttons out of the row; the button column stays aligned to the
  top of the line.
- **Move up** / **Move down** swap the current `.checkbox-in-set` element with
  its previous/next sibling inside `.checkbox-set-controls`, using jQuery
  `insertBefore()` / `insertAfter()`. The swap happens instantly — no
  transition animation. The first line's "move up" button and the last
  line's "move down" button are shown disabled rather than hidden, so the
  button layout stays stable from line to line.
- No data model or server-side change is needed: option order is just DOM
  order of `.checkbox-in-set` elements inside `.checkbox-set-controls`, the
  same way adding and removing an option is handled today. Order is captured
  when the control group's HTML is serialized on save.
- Update `inputview/checkbox_set_button.jade` to add the two new buttons, and
  regenerate `public/builder/input.js` by running `node template.js` (per the
  instructions at the top of that file).
- Add `click` handlers for the new "move up" / "move down" buttons in
  `binding_checkbox_set_events`, next to the existing edit/remove handlers.
- Update the tooltip on the top-level "Adjust location" button (`#adjust`,
  `public/javascripts/form-builder.js`) to clarify that it reorders whole
  control groups, not the options inside a checkbox set, so the two
  reordering mechanisms aren't confused.

## Drawbacks

- Four buttons need more horizontal space than two; on narrow viewports the
  label column shrinks further, so text wraps more often.
- Moving one line at a time is slower than drag-and-drop for a large
  reorder — moving an option from the top to the bottom of a 20-item list
  takes many clicks.
- The form builder already has a top-level "Adjust location" drag-and-drop
  mode (`#adjust` button, `public/javascripts/form-builder.js`) that reorders
  whole control groups via jQuery UI `sortable`. Having a second, different
  reordering mechanism for options inside a checkbox set may be confusing.

## Alternatives

- **Drag-and-drop (jQuery UI `sortable`)**: the same mechanism used for the
  top-level "Adjust location" mode. Rejected for this case because
  `.checkbox-set-controls` lives inside an actively-editing `.well.spec`
  panel, and enabling `sortable` there while still supporting hover-to-edit
  would need its own mode toggle, the way "Adjust location" does at the top
  level. Per-line move buttons need no separate mode and work without extra
  state.
- **Numeric position field**: let the user type a target position for each
  option. Rejected as less discoverable and more error-prone than a move
  button for the common case of nudging an option by one or two spots.

## Unresolved Questions

None at this time. The open questions from the initial draft were resolved
during review and are reflected in Detailed Design above: first/last-line
move buttons are shown disabled rather than hidden, the swap is instant with
no animation, and the "Adjust location" tooltip will be updated to
disambiguate it from per-option reordering.
