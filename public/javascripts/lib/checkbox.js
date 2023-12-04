/* eslint-disable import/prefer-default-export */
/* eslint-disable import/extensions */
/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global input, spec */

import { add_new_cgr, binding } from './form-builder-shared.js';

export function checkbox_edit($cgr, $target = $('#output')) {
  $('#output .well.spec').remove();
  let userkey = '';
  let checkbox_text = 'checkbox text';
  if ($cgr) {
    userkey = $('.controls input', $cgr).data('userkey');
    checkbox_text = $('.controls label span', $cgr).text();
  }
  const $checkbox = $(input.checkbox_in_set());
  const $buttons = $(input.checkbox_set_button());
  const $userkey = $(spec.userkey());
  const $checkbox_text = $(spec.checkbox_text());
  const $done = $(spec.done());
  const $edit = $('<div class="well spec"></div>').append(
    $userkey,
    $checkbox_text,
    $done
  );
  const $new_cgr = $(
    '<div class="checkbox-in-set" data-status="editing"></div>'
  ).append($checkbox);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit, $target);
  const model = {
    userkey,
    checkbox_text,
  };
  $('input', $userkey).val(userkey);
  $('input', $checkbox_text).val(checkbox_text);

  binding($edit, $checkbox, model, $done);
}
