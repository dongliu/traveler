/* eslint-disable import/extensions */
/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global input, spec */

import { add_new_cgr, binding } from './form-builder-shared.js';
import { checkbox_edit } from './checkbox.js';

export function add_checkbox($checkbox_set_controls) {
  // Add a checkbox spec into the set
  checkbox_edit(null, $checkbox_set_controls);
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
  const $done = $(spec.done());

  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    help = $('.controls span.help-block', $cgr).text();
    // add existing checkboxes into div.checkbox-set-controls of $checkbox_set
    $('.checkbox-set-controls', $checkbox_set).replaceWith(
      $('.checkbox-set-controls', $cgr)
    );
  }

  // Assign components to the configure view
  const $edit = $('<div class="well spec"></div>').append(
    $label,
    $help,
    $add_checkbox_button,
    $done
  );

  const $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">checkbox-set</span></div>'
  );
  $new_cgr.append($checkbox_set);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  const model = {
    label,
    help,
  };
  $('input', $label).val(label);
  $('input', $help).val(help);

  binding($edit, $checkbox_set, model, $done);

  const $checkbox_set_controls = $('.checkbox-set-controls', $new_cgr);

  $add_checkbox_button.unbind('click');

  // Add functionality for adding and removing checkbox in the group
  $add_checkbox_button.on('click', 'button', function(e) {
    e.preventDefault();
    add_checkbox($checkbox_set_controls);
  });
}

export function binding_checkbox_set_events() {
  $('#output').on(
    'mouseenter',
    '.control-group-wrap[data-status="editing"] .checkbox-in-set',
    function(e) {
      e.preventDefault();
      if ($('.checkbox-set-buttons', $(this)).length > 0) {
        $('.checkbox-set-buttons', $(this)).show();
      } else {
        $(this).append(input.checkbox_set_button());
      }
    }
  );

  $('#output').on(
    'mouseleave',
    '.control-group-wrap[data-status="editing"] .checkbox-in-set',
    function(e) {
      e.preventDefault();
      $('.checkbox-set-buttons', $(this)).hide();
    }
  );

  $('#output').on(
    'click',
    '.checkbox-in-set a.btn.btn-warning[title="remove the checkbox"]',
    function(e) {
      e.preventDefault();
      const $checkbox = $(this).closest('.checkbox-in-set');
      $checkbox.remove();
    }
  );

  $('#output').on(
    'click',
    '.checkbox-in-set a.btn.btn-info[title="edit the checkbox"]',
    function(e) {
      e.preventDefault();
      const $this = $(this);
      $('.checkbox-set-buttons', $this).hide();
      const $checkbox = $this.closest('.checkbox-in-set');
      const $target = $this.closest('.checkbox-set-controls');
      checkbox_edit($checkbox, $target);
    }
  );
}
