/* eslint-disable import/extensions */
/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global UID, input, spec */

import { add_new_cgr, binding } from './form-builder-shared.js';

export function add_checkbox(
  $checkbox_set,
  $checkbox_value_spec,
  $done,
  count,
  model
) {
  // Add checkbox spec
  const $checkbox_text = $(
    spec.generic_text_input({ label: `Checkbox ${count} text` })
  );
  $('input', $checkbox_text).attr('name', `checkbox_${count}_text`);
  $($checkbox_value_spec).append($checkbox_text);
  const $userkey = $(
    spec.generic_text_input({ label: `Checkbox ${count} userkey` })
  );
  $('input', $userkey).attr('name', `checkbox_${count}_userkey`);
  $($checkbox_value_spec).append($userkey);

  // Add checkbox input control
  const $checkbox_control = $(input.checkbox_member());
  $('input', $checkbox_control).attr(
    'rv-value',
    `model.checkbox_${count}_text`
  );
  $('input', $checkbox_control).attr(
    'rv-data-userkey',
    `model.checkbox_${count}_userkey`
  );
  $('span.checkbox_text', $checkbox_control).attr(
    'rv-text',
    `model.checkbox_${count}_text`
  );
  $checkbox_set.find('.controls .checkboxes').append($checkbox_control);

  // Add button and handler to remove radio button
  $($checkbox_text)
    .find('.controls')
    .append(
      '<button value="remove-checkbox" class="btn btn-warning">-</button>'
    );
  // TODO: remove by value is not reliable because value can be the same
  // we do not have a way to validate the value yet.
  $checkbox_text.on('click', 'button[value="remove-checkbox"]', function(e) {
    e.preventDefault();

    const text_input = $checkbox_text.find('input');
    const value = text_input.val();
    const checkbox = $checkbox_set
      .find(`input[type="checkbox"][value="${value}"]`)
      .parent();
    const text_model = text_input.prop('name');
    model[text_model] = undefined;
    const key_model = $userkey.prop('name');
    model[key_model] = undefined;
    checkbox.remove();
    $checkbox_text.remove();
    $userkey.remove();
  });

  let checkbox_text = `checkbox_${count}`;

  if (model[`checkbox_${count}_text`]) {
    checkbox_text = model[`checkbox_${count}_text`];
  }

  $('input', $checkbox_text).val(checkbox_text);

  if (model[`checkbox_${count}_userkey`]) {
    $('input', $userkey).val(model[`checkbox_${count}_userkey`]);
  }
}

export function checkbox_set_edit($cgr) {
  $('#output .well.spec').remove();

  let label = 'label';
  let help = '';
  // get all input components
  const $checkbox_set = $(input.checkbox_set());
  const $buttons = $(input.button());

  // get configuration (spec) view components
  const $label = $(spec.label());
  const $help = $(spec.help());

  const $add_checkbox_button = $(spec.add_checkbox_button());
  const $checkbox_value_spec = $('<div class="checkbox-value-spec"></div>');
  const $done = $(spec.done());

  let checkbox_count = 0;

  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    help = $('.controls span.help-block', $cgr).text();
  }

  // Assign components to the configure view
  const $edit = $('<div class="well spec"></div>').append(
    $label,
    $help,
    $add_checkbox_button,
    $checkbox_value_spec,
    $done
  );

  const $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">checkbox-set</span></div>'
  ).append($checkbox_set);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  const model = {
    label,
    help,
  };
  $('input', $label).val(label);
  $('input', $help).val(help);

  // render the checkboxes
  if ($cgr) {
    // load the checkboxes for edit mode
    const checkboxes = $cgr.find('.controls').find('input');
    $.map(checkboxes, function(checkbox, count) {
      const $checkbox = $(checkbox);
      model[`checkbox_${count}_text`] = $checkbox.prop('value');
      const userkey = $checkbox.data('userkey');
      if (userkey) {
        model[`checkbox_${count}_userkey`] = userkey;
      }
    });
    const length = checkboxes.size();
    for (let i = 0; i < length; i += 1) {
      add_checkbox(
        $checkbox_set,
        $checkbox_value_spec,
        $done,
        checkbox_count,
        model
      );
      checkbox_count += 1;
    }
  } else {
    // Add the first
    model[`checkbox_${checkbox_count}_text`] = `checkbox_${checkbox_count}`;
    add_checkbox(
      $checkbox_set,
      $checkbox_value_spec,
      $done,
      checkbox_count,
      model
    );
    checkbox_count += 1;
  }

  let checkbox_set_view = binding($edit, $checkbox_set, model, $done);

  $add_checkbox_button.unbind('click');

  // Add functionality for adding and removing checkbox in the group
  $add_checkbox_button.on('click', 'button', function(e) {
    e.preventDefault();
    model[`checkbox_${checkbox_count}_text`] = `checkbox_${checkbox_count}`;
    add_checkbox(
      $checkbox_set,
      $checkbox_value_spec,
      $done,
      checkbox_count,
      model
    );

    checkbox_count += 1;

    // we need unbind the view and bind again
    checkbox_set_view.unbind();
    checkbox_set_view = binding($edit, $checkbox_set, model, $done);
  });
}
