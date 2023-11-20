/* eslint-disable import/extensions */
/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global UID, input, spec */

import { add_new_cgr, binding } from './form-builder-shared.js';

export function add_radio(
  $radio_group,
  $radio_value_spec,
  $done,
  count,
  model
) {
  // Add radio button text configuration screen
  const $radio_text = $(
    spec.generic_text_input({ label: `Radio button ${count} value` })
  );
  $('input', $radio_text).attr('name', `radio_text_${count}`);
  $($radio_value_spec).append($radio_text);

  // Add radio button input control
  const $radio_button_control = $(input.radio_button());
  $('input', $radio_button_control).attr(
    'rv-value',
    `model.radio_text_${count}`
  );
  $('span.radio_text', $radio_button_control).attr(
    'rv-text',
    `model.radio_text_${count}`
  );
  $radio_group.find('.controls .radios').append($radio_button_control);

  // Add button and handler to remove radio button
  $($radio_text)
    .find('.controls')
    .append(
      '<button value="remove-radio-button" class="btn btn-warning">-</button>'
    );
  $radio_text.on('click', 'button[value="remove-radio-button"]', function(e) {
    e.preventDefault();

    const value = $(e.delegateTarget)
      .find('input')
      .val();
    const name = $(e.delegateTarget)
      .find('input')
      .prop('name');
    const radio = $radio_group
      .find(`input[type="radio"][value="${value}"]`)
      .parent();
    model[name] = undefined;
    radio.remove();
    e.delegateTarget.remove();
  });

  let radio_text = `radio_text_${count}`;

  if (model[`radio_text_${count}`]) {
    radio_text = model[`radio_text_${count}`];
  }

  $('input', $radio_text).val(radio_text);
}

export function checkbox_set_edit($cgr) {
  $('#output .well.spec').remove();

  let checkbox_set_name;

  let label = 'label';
  let userkey = '';
  let required = false;
  let help = '';
  // get all input components
  const $checkbox_set = $(input.checkbox_set());
  const $buttons = $(input.button());

  // get configuration (spec) view components
  const $label = $(spec.label());
  const $userkey = $(spec.userkey());
  const $required = $(spec.required());
  const $help = $(spec.help());

  const $add_checkbox_button = $(spec.add_checkbox_button());
  const $checkbox_value_spec = $('<div class="checkbox-value-spec"></div>');
  const $done = $(spec.done());

  let checkbox_count = 0;

  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    const inputs = $cgr.find('.controls').find('input');
    help = $('.controls span.help-block', $cgr).text();
    // TBD: how to define user key and required?
    // if we want to have a single user key for the fieldset then the fieldset should be submitted
    // as an array, which requires binding changes

    // the required for a fieldset cannot be defined

    // if (inputs.length > 0) {
    //   checkbox_set_name = inputs[0].name;
    //   userkey = $(inputs[0]).data('userkey');
    //   required = $(inputs[0]).prop('required');
    // }
  }

  // if (!checkbox_set_name) {
  //   checkbox_set_name = UID.generateShort();
  // }

  // Assign components to the configure view
  const $edit = $('<div class="well spec"></div>').append(
    $label,
    // $userkey,
    // $required,
    $help,
    $add_checkbox_button,
    $checkbox_value_spec,
    $done
  );

  const $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">radio</span></div>'
  ).append($checkbox_set);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  const model = {
    label,
    // userkey,
    // required,
    name: checkbox_set_name,
    help,
  };
  $('input', $label).val(label);
  // $('input', $userkey).val(userkey);
  // $('input', $required).prop('checked', required);
  $('input', $help).val(help);

  // render the checkboxes
  if ($cgr) {
    // load the radio buttons for edit mode
    const checkboxes = $cgr.find('.controls').find('input');
    // $.map(checkboxes, function(button, i) {
    //   model[`radio_text_${i}`] = $(button).prop('value');
    // });
    // const length = checkboxes.size();
    // for (let i = 0; i < length; i += 1) {
    //   add_radio(
    //     $checkbox_set,
    //     $checkbox_value_spec,
    //     $done,
    //     checkbox_count,
    //     model
    //   );
    //   checkbox_count += 1;
    // }
  } else {
    // Add initial radio button
    // model[
    //   `radio_text_${checkbox_count}`
    // ] = `radio_text_${checkbox_count}`;
    // add_radio(
    //   $checkbox_set,
    //   $checkbox_value_spec,
    //   $done,
    //   checkbox_count,
    //   model
    // );
    // checkbox_count += 1;
  }

  let checkbox_set_view = binding($edit, $checkbox_set, model, $done);

  $add_checkbox_button.unbind('click');

  // Add functionality for adding and removing radio buttons in the group
  $add_checkbox_button.on('click', 'button', function(e) {
    e.preventDefault();
    model[`radio_text_${checkbox_count}`] = `radio_text_${checkbox_count}`;
    add_radio(
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
