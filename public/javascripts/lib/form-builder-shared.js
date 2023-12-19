/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global rivets, UID */

export function userkey_error($userkey, msg) {
  if (!$userkey.closest('.control-group').hasClass('error')) {
    $userkey
      .closest('.controls')
      .append(`<div class="validation text-error">${msg}</div>`)
      .closest('.control-group')
      .addClass('error');
  }
}

export function rangeText(min, max) {
  const output = [];
  if (typeof min === 'number') {
    output.push(`min: ${min}`);
  }
  if (typeof max === 'number') {
    output.push(`max: ${max}`);
  }
  return output.join(', ') || null;
}

/**
 * Add a new control group to the default output or another location. A new checkbox can be added into a checkbox set
 * @param {*} $cgr the existing control group if any
 * @param {*} $new_cgr the new control group to add or replace the existing one
 * @param {*} $buttons the editing buttons associated with the control group
 * @param {*} $spec the spec controls
 * @param {*} $target the place to add the control group default to the output, can be a special location like the checkbox set
 */
export function add_new_cgr(
  $cgr,
  $new_cgr,
  $buttons,
  $spec,
  $target = $('#output')
) {
  if ($buttons) {
    $new_cgr.prepend($buttons.hide());
  }
  if ($cgr) {
    if ($('span.fe-type', $cgr).text() !== 'radio') {
      // reserve important attributes that are not covered but rivet model binding like unique name
      $('input, textarea, img', $new_cgr).attr(
        'name',
        $('input, textarea, img', $cgr).attr('name')
      );
    }
    // reserve legend id
    $('legend', $new_cgr).attr('id', $('legend', $cgr).attr('id'));

    $cgr.replaceWith($new_cgr);
    $new_cgr.after($spec);
  } else {
    $target.append($new_cgr);
    $target.append($spec);
  }
}

export function updateSectionNumbers() {
  let sectionNumber = 0;
  let instructionNumber = 0;
  let controlNumber = 0;
  // assign the sequence number to all legend
  $('#output')
    .find('legend, .control-label, .rich-instruction')
    .each(function() {
      if ($(this).is('legend')) {
        sectionNumber += 1;
        // reset control number
        controlNumber = 0;
        instructionNumber = 0;
        $(this)
          .find('.section-number')
          .text(sectionNumber);
      } else if ($(this).is('div.rich-instruction')) {
        instructionNumber += 1;
        // reset control number
        controlNumber = 0;

        $(this)
          .find('.rich-instruction-number')
          .text(`${sectionNumber}.${instructionNumber}`);
      } else {
        controlNumber += 1;
        $(this)
          .find('.control-number')
          .text(`${sectionNumber}.${instructionNumber}.${controlNumber}`);
      }
    });
}

export function done_button(view, $rendered) {
  return function(e) {
    e.preventDefault();
    // validate the userkey according to current form
    const userKeyInput = $('.well.spec input[name="userkey"]');
    let userkey = userKeyInput.val();
    if (typeof userkey !== 'undefined') {
      userkey = userkey.trim();
      if (!userKeyInput[0].validity.valid) {
        userkey_error(userKeyInput, 'Invalid userkey format');
        return;
      }
      if (
        userkey &&
        $(
          `.control-group-wrap[data-status!="editing"] input[data-userkey="${userkey}"]`
        ).length >= 1
      ) {
        userkey_error(userKeyInput, 'duplicated userkey found');
        return;
      }
    }
    view.unbind();
    $(this)
      .closest('.spec')
      .remove();
    // assign unique name if not yet
    $('input, textarea', $rendered).each(function() {
      if (!$(this).attr('name')) {
        $(this).attr('name', UID.generateShort());
      }
    });

    // assign id to legent, id is used for side nav
    $('legend', $rendered).each(function() {
      if (!$(this).attr('id')) {
        $(this).attr('id', UID.generateShort());
      }
    });

    updateSectionNumbers();
    $rendered
      .closest('.control-group-wrap, .checkbox-in-set')
      .removeAttr('data-status');
  };
}

export function binding($edit, $rendered, model, $done) {
  $('input:text', $edit).on('input', function() {
    model[$(this).attr('name')] = $(this)
      .val()
      .trim();
    if ($(this).attr('name') === 'userkey') {
      // remove validation message if any
      if (
        $(this)
          .closest('.control-group')
          .hasClass('error')
      ) {
        $(this)
          .closest('.control-group')
          .removeClass('error')
          .find('.validation')
          .remove();
      }
    }
  });

  $('input[type="number"]', $edit).on('input', function() {
    const val = $(this)
      .val()
      .trim();
    if (val === '') {
      model[$(this).attr('name')] = null;
    } else {
      model[$(this).attr('name')] = Number($(this).val());
    }
    if ($(this).attr('name') === 'min' || $(this).attr('name') === 'max') {
      model.range = rangeText(model.min, model.max);
    }
  });

  $('select', $edit).change(function() {
    model[$(this).attr('name')] = $(this).val();
  });

  $('input:checkbox', $edit).change(function() {
    model[$(this).attr('name')] = $(this).prop('checked');
  });

  const view = rivets.bind($rendered, {
    model,
  });

  // clean all click handlers to the $done button first
  $done.unbind('click');
  $done.click(done_button(view, $rendered));

  return view;
}
