/* eslint-disable func-names */
/* eslint-disable no-param-reassign */
/* global rivets, UID, input, spec */

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

export function add_new_cgr($cgr, $new_cgr, $buttons, $edit) {
  $new_cgr.prepend($buttons.hide());
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
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
    $('#output').append($edit);
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

export function done_button(view, $out) {
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
    $('input, textarea', $out).each(function() {
      if (!$(this).attr('name')) {
        $(this).attr('name', UID.generateShort());
      }
    });

    // assign id to legent, id is used for side nav
    $('legend', $out).each(function() {
      if (!$(this).attr('id')) {
        $(this).attr('id', UID.generateShort());
      }
    });

    updateSectionNumbers();
    $out.closest('.control-group-wrap').removeAttr('data-status');
  };
}

export function binding($edit, $out, model, $done) {
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

  const view = rivets.bind($out, {
    model,
  });

  // clean all click handlers to the $done button first
  $done.unbind('click');
  $done.click(done_button(view, $out));

  return view;
}
