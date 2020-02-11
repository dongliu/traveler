/* global formStatus: false, window: false, FormData: false*/

/* global tinymce: false, rivets: false, UID: false, input: false, spec: false,
 ajax401: false, disableAjaxCache:false, prefix: false, updateAjaxURL: false, 
 formType, livespan*/

/* eslint max-nested-callbacks: [2, 4], complexity: [2, 20] */

var mce_content = {
  selector: 'textarea.tinymce',
  content_css: '/bootstrap/css/bootstrap.css',
  browser_spellcheck: true,
  plugins: [
    ['advlist autolink link image lists charmap hr anchor spellchecker'],
    ['wordcount visualblocks visualchars code media nonbreaking'],
    ['contextmenu directionality paste'],
  ],
  toolbar1:
    'charmap | link image | undo redo | removeformat | bullist numlist outdent indent | formatselect bold italic underline strikethrough',
  contextmenu: 'charmap link image',
  menubar: false,
  statusbar: false,
};

var initHtml = '';

/**
 * send request with data, and exec cb on response
 *
 * @param   {Object}  data    request body data
 * @param   {function}  cb    callback
 * @param   {string}  option  available options
 *
 * @return  {void}
 */
function sendRequest(data, cb, option) {
  var path = window.location.pathname;
  var url;
  var type;
  if (option === 'saveas') {
    url = prefix + '/forms/';
    type = 'POST';
  } else if (option === 'status') {
    url = path + 'status';
    type = 'PUT';
  } else if (option === 'release') {
    url = path + 'released';
    type = 'PUT';
  } else {
    url = path;
    type = 'PUT';
  }
  $.ajax({
    url: url,
    type: type,
    async: true,
    data: JSON.stringify(data),
    contentType: 'application/json',
    processData: false,
  })
    .done(function(data, textStatus, request) {
      var timestamp = request.getResponseHeader('Date');
      if (data.location) {
        document.location.href = data.location;
      } else {
        $('#message').append(
          '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The changes were saved ' +
            livespan(timestamp) +
            '.</div>'
        );
      }
      $.livestamp.resume();
      if (cb) {
        cb();
      }
    })
    .fail(function() {
      $('form#output').fadeTo('slow', 1);
    })
    .always(function() {});
}

function userkey_error($userkey, msg) {
  if (!$userkey.closest('.control-group').hasClass('error')) {
    $userkey
      .closest('.controls')
      .append('<div class="validation text-error">' + msg + '</div>')
      .closest('.control-group')
      .addClass('error');
  }
}

function updateSectionNumbers() {
  var sectionNumber = 0;
  var instructionNumber = 0;
  var controlNumber = 0;
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
        //reset control number
        controlNumber = 0;

        $(this)
          .find('.rich-instruction-number')
          .text('' + sectionNumber + '.' + instructionNumber);
      } else {
        controlNumber += 1;
        $(this)
          .find('.control-number')
          .text(
            '' + sectionNumber + '.' + instructionNumber + '.' + controlNumber
          );
      }
    });
}

function addSectionNumbers() {
  $('#output')
    .find('legend, .control-label, .tinymce')
    .each(function() {
      if ($(this).is('legend')) {
        prependSpanIfNotExists(this, 'section-number');
      } else if ($(this).is('div.tinymce')) {
        var instructionParent = this.parentElement;
        addSectionNumberToRichInstruction(instructionParent);
      } else {
        prependSpanIfNotExists(this, 'control-number');
      }
    });
}

function addSectionNumberToRichInstruction(richInstructionParent) {
  if (richInstructionParent.className != 'rich-instruction') {
    var tinymceChild = $(richInstructionParent).find('.tinymce')[0];
    richInstructionParent.removeChild(tinymceChild);

    var richInstructionDiv = document.createElement('div');
    richInstructionDiv.className = 'rich-instruction';
    richInstructionDiv.appendChild(tinymceChild);
    richInstructionParent.appendChild(richInstructionDiv);
    richInstructionParent = richInstructionDiv;
  }

  prependSpanIfNotExists(richInstructionParent, 'rich-instruction-number');
}

function prependSpanIfNotExists(element, sectionName) {
  if ($(element).find('.' + sectionName).length === 0) {
    $(element).prepend('<span class="' + sectionName + '"></span>&nbsp;');
  }
}

function done_button(view, $out) {
  return function(e) {
    e.preventDefault();
    // validate the userkey according to current form
    var userKeyInput = $('.well.spec input[name="userkey"]');
    var userkey = userKeyInput.val();
    if (typeof userkey !== 'undefined') {
      userkey = userkey.trim();
      if (!userKeyInput[0].validity.valid) {
        userkey_error(userKeyInput, 'Invalid userkey format');
        return;
      }
      if (
        userkey &&
        $(
          '.control-group-wrap[data-status!="editing"] input[data-userkey="' +
            userkey +
            '"]'
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

function add_new_cgr($cgr, $new_cgr, $buttons, $edit) {
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

function binding($edit, $out, model, $done) {
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
    var val = $(this)
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

  var view = rivets.bind($out, {
    model: model,
  });

  // clean all click handlers to the $done button first
  $done.unbind('click');
  $done.click(done_button(view, $out));

  return view;
}

/**
 * add the count th radio button in the model to the $raido_group with spec in the #radio_value_spec
 * @param {$} $radio_group      the radio group object
 * @param {$} $radio_value_spec the radio value/text spec object
 * @param {$} $done             the done button object
 * @param {int} count           the number of radio to add
 * @param {object} model        the model
 *
 * @return {undefined}
 */
function add_radio($radio_group, $radio_value_spec, $done, count, model) {
  // Add radio button text configuration screen
  var $radio_text = $(
    spec.generic_text_input({ label: 'Radio button ' + count + ' value' })
  );
  $('input', $radio_text).attr('name', 'radio_text_' + count);
  $($radio_value_spec).append($radio_text);

  // Add radio button input control
  var $radio_button_control = $(input.radio_button());
  $('input', $radio_button_control).attr(
    'rv-value',
    'model.radio_text_' + count
  );
  $('span.radio_text', $radio_button_control).attr(
    'rv-text',
    'model.radio_text_' + count
  );
  $radio_group.find('.controls').append($radio_button_control);

  // Add button and handler to remove radio button
  $($radio_text)
    .find('.controls')
    .append(
      '<button value="remove-radio-button" class="btn btn-warning">-</button>'
    );
  $radio_text.on('click', 'button[value="remove-radio-button"]', function(e) {
    e.preventDefault();

    var value = $(e.delegateTarget)
      .find('input')
      .val();
    var name = $(e.delegateTarget)
      .find('input')
      .prop('name');
    var radio = $radio_group
      .find('input[type="radio"][value="' + value + '"]')
      .parent();
    model[name] = undefined;
    radio.remove();
    e.delegateTarget.remove();
  });

  var radio_text = 'radio_text_' + count;

  if (model['radio_text_' + count]) {
    radio_text = model['radio_text_' + count];
  }

  $('input', $radio_text).val(radio_text);
}

function radio_edit($cgr) {
  $('#output .well.spec').remove();

  var radio_group_name;

  var label = 'label';
  var userkey = '';
  var required = false;
  // get all input components
  var $radio_group = $(input.radiogroup());
  var $buttons = $(input.button());

  // get configuration (spec) view components
  var $label = $(spec.label());
  var $userkey = $(spec.userkey());
  var $required = $(spec.required());

  var $add_radio_button = $(spec.add_radio_button());
  var $radio_value_spec = $('<div class="radio-value-spec"></div>');
  var $done = $(spec.done());

  var radio_button_count = 0;

  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    var inputs = $cgr.find('.controls').find('input');
    if (inputs.length > 0) {
      radio_group_name = inputs[0].name;
      userkey = $(inputs[0]).data('userkey');
      required = $(inputs[0]).prop('required');
    }
  }

  if (!radio_group_name) {
    radio_group_name = UID.generateShort();
  }

  // Assign components to the configure view
  var $edit = $('<div class="well spec"></div>').append(
    $label,
    $userkey,
    $required,
    $add_radio_button,
    $radio_value_spec,
    $done
  );

  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">radio</span></div>'
  ).append($radio_group);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  var model = {
    label: label,
    userkey: userkey,
    required: required,
    name: radio_group_name,
  };
  $('input', $label).val(label);
  $('input', $userkey).val(userkey);
  $('input', $required).prop('checked', required);

  // add all the radio buttons
  if ($cgr) {
    // load the radio buttons for edit mode
    var radio_buttons = $cgr.find('.controls').find('input');
    $.map(radio_buttons, function(button, i) {
      model['radio_text_' + i] = $(button).prop('value');
    });
    var length = radio_buttons.size();
    for (var i = 0; i < length; i++) {
      add_radio(
        $radio_group,
        $radio_value_spec,
        $done,
        radio_button_count,
        model
      );
      radio_button_count += 1;
    }
  } else {
    // Add initial radio button
    model['radio_text_' + radio_button_count] =
      'radio_text_' + radio_button_count;
    add_radio(
      $radio_group,
      $radio_value_spec,
      $done,
      radio_button_count,
      model
    );
    radio_button_count += 1;
  }

  var radio_group_view = binding($edit, $radio_group, model, $done);

  $add_radio_button.unbind('click');

  // Add functionality for adding and removing radio buttons in the group
  $add_radio_button.on('click', 'button', function(e) {
    e.preventDefault();
    model['radio_text_' + radio_button_count] =
      'radio_text_' + radio_button_count;
    add_radio(
      $radio_group,
      $radio_value_spec,
      $done,
      radio_button_count,
      model
    );

    radio_button_count += 1;

    // we need unbind the $radio_group view and bind again
    radio_group_view.unbind();
    radio_group_view = binding($edit, $radio_group, model, $done);
  });
}

function checkbox_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var userkey = '';
  var checkbox_text = 'checkbox text';
  var required = false;
  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    userkey = $('.controls input', $cgr).data('userkey');
    checkbox_text = $('.controls label span', $cgr).text();
    required = $('input', $cgr).prop('required');
  }
  var $checkbox = $(input.checkbox());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $userkey = $(spec.userkey());
  var $checkbox_text = $(spec.checkbox_text());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append(
    $label,
    $userkey,
    $checkbox_text,
    $required,
    $done
  );
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">checkbox</span></div>'
  ).append($checkbox);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  var model = {
    label: label,
    userkey: userkey,
    checkbox_text: checkbox_text,
    required: required,
  };
  $('input', $label).val(label);
  $('input', $userkey).val(userkey);
  $('input', $checkbox_text).val(checkbox_text);
  $('input', $required).prop('checked', required);

  binding($edit, $checkbox, model, $done);
}

function text_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var userkey = '';
  var placeholder = '';
  var help = '';
  var required = false;
  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    userkey = $('.controls input', $cgr).data('userkey');
    placeholder = $('.controls input', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
    required = $('.controls input', $cgr).prop('required');
  }
  var $text = $(input.text());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $userkey = $(spec.userkey());
  var $placeholder = $(spec.placeholder());
  var $help = $(spec.help());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append(
    $label,
    $userkey,
    $placeholder,
    $help,
    $required,
    $done
  );
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">text</span></div>'
  ).append($text);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  var model = {
    label: label,
    userkey: userkey,
    placeholder: placeholder,
    help: help,
    required: required,
  };
  $('input', $label).val(label);
  $('input', $userkey).val(userkey);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $required).prop('checked', required);
  binding($edit, $text, model, $done);
}

function figure_edit($cgr) {
  $('#output .well.spec').remove();
  var src = '';
  var alt = '';
  var figcaption = '';
  var width = '';
  if ($cgr) {
    src = $('img', $cgr).attr('src');
    alt = $('img', $cgr).attr('alt');
    figcaption = $('figcaption', $cgr).text();
    width = $('img', $cgr).attr('width') || $('img', $cgr).prop('clientWidth');
  }
  var $figure = $(input.figure());
  var $buttons = $(input.button());
  var $file = $(spec.imagefile());
  var $alt = $(spec.alt());
  var $figcaption = $(spec.figcaption());
  var $width = $(spec.width());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append(
    $file,
    $alt,
    $width,
    $figcaption,
    $done
  );
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">figure</span></div>'
  ).append($figure);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);

  // need a handler here for the $done button if no image exist or updated
  $done.click(function(e) {
    e.preventDefault();
    $edit.remove();
    $new_cgr.remove();
  });

  var model;
  if ($cgr) {
    $('img', $figure).prop('src', src);
    // enable the spec inputs
    $('input', $alt).removeAttr('disabled');
    $('input', $figcaption).removeAttr('disabled');
    $('input', $width).removeAttr('disabled');

    $('input', $alt).val(alt);
    $('input', $figcaption).val(figcaption);
    $('input', $width).val(width);

    model = {
      alt: alt,
      figcaption: figcaption,
      width: width,
    };

    binding($edit, $figure, model, $done);
  }

  // handle image upload here
  $('input:file', $file).change(function(e) {
    e.preventDefault();
    var file = this.files[0];
    if (file === undefined) {
      $file.children('.file-upload-buttons').remove();
      return;
    }

    var $validation = $file.find('.validation');
    if ($validation.length) {
      $validation = $($validation[0]);
    } else {
      $validation = $('<div class="validation"></div>').appendTo(
        $file.find('.controls')
      );
    }

    if (!/image\/(gif|jpe?g|png)$/i.test(file.type)) {
      $validation.html(
        '<p class="text-error">' + file.type + ' is not allowed to upload</p>'
      );
      $file.children('.file-upload-buttons').remove();
      return;
    }

    if (file.size > 5000000) {
      $validation.html(
        '<p class="text-error">' + file.size + ' is too large to upload</p>'
      );
      $file.children('.file-upload-buttons').remove();
      return;
    }

    // clear validation message if any
    $validation.empty();

    if ($file.children('.control-group-buttons').length === 0) {
      $file.prepend(
        '<div class="pull-right file-upload-buttons"><button value="upload" class="btn btn-primary">Upload</button> <button value="cancel" class="btn">Cancel</button></div>'
      );
    }
  });

  $file.on('click', 'button[value="upload"]', function(e) {
    e.preventDefault();
    // ajax to save the current value
    var $this = $(this);
    $this.attr('disabled', true);
    var input = $file.find('input')[0];
    var data = new FormData();
    data.append('name', input.name);
    data.append('type', input.type);
    data.append(input.name, input.files[0]);
    $.ajax({
      url: './uploads/',
      type: 'POST',
      processData: false,
      contentType: false, // important for jqXHR
      data: data,
    })
      .done(function(res, status, jqXHR) {
        var location = jqXHR.getResponseHeader('Location');
        var timestamp = jqXHR.getResponseHeader('Date');
        $('#message').append(
          '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>File uploaded ' +
            livespan(timestamp) +
            '</div>'
        );
        $.livestamp.resume();

        // set the figure attributes
        $('img', $figure).attr(
          'name',
          location.substr(location.lastIndexOf('/') + 1)
        );
        $('img', $figure).attr('src', location);
        $this.closest('.file-upload-buttons').remove();

        // enable the spec inputs
        $('input', $alt).removeAttr('disabled');
        $('input', $figcaption).removeAttr('disabled');
        $('input', $width).removeAttr('disabled');

        alt = input.files[0].name;
        figcaption = input.files[0].name;

        $('input', $alt).val(alt);
        $('input', $figcaption).val(figcaption);

        model = {
          alt: alt,
          figcaption: figcaption,
          width: width,
        };

        binding($edit, $figure, model, $done);
      })
      .fail(function(jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot upload the file: ' +
              (jqXHR.responseText || 'unknown') +
              '</div>'
          );
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      })
      .always(function() {});
  });

  $file.on('click', 'button[value="cancel"]', function(e) {
    e.preventDefault();
    $(this)
      .closest('.file-upload-buttons')
      .remove();
  });
}

function other_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var userkey = '';
  var placeholder = '';
  var help = '';
  var type = 'text';
  var required = false;
  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    userkey = $('.controls input', $cgr).data('userkey');
    placeholder = $('.controls input', $cgr).attr('placeholder');
    type = $('.controls input', $cgr).attr('type');
    help = $('.controls span.help-block', $cgr).text();
    required = $('input', $cgr).prop('required');
  }
  var $other = $(input.other());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $userkey = $(spec.userkey());
  var $placeholder = $(spec.placeholder());
  var $type = $(spec.type());
  var $help = $(spec.help());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append(
    $type,
    $label,
    $userkey,
    $placeholder,
    $help,
    $required,
    $done
  );
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">other</span></div>'
  ).append($other);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);

  var model = {
    label: label,
    userkey: userkey,
    placeholder: placeholder,
    type: type,
    help: help,
    required: required,
  };
  $('input', $label).val(label);
  $('input', $userkey).val(userkey);
  $('select', $type).val(type);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $required).prop('checked', required);

  binding($edit, $other, model, $done);
}

function textarea_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var userkey = '';
  var placeholder = '';
  var rows = 3;
  var help = '';
  var required = false;

  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    userkey = $('.controls textarea', $cgr).data('userkey');
    placeholder = $('.controls textarea', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
    rows = $('.controls textarea', $cgr).attr('rows');
    required = $('textarea', $cgr).prop('required');
  }

  var $textarea = $(input.textarea());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $userkey = $(spec.userkey());
  var $placeholder = $(spec.placeholder());
  var $rows = $(spec.rows());
  var $help = $(spec.help());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append(
    $label,
    $userkey,
    $placeholder,
    $rows,
    $help,
    $required,
    $done
  );
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">textarea</span></div>'
  ).append($textarea);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);

  var model = {
    label: label,
    userkey: userkey,
    placeholder: placeholder,
    rows: rows,
    help: help,
    required: required,
  };

  $('input', $label).val(label);
  $('input', $userkey).val(userkey);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $rows).val(rows);
  $('input', $required).prop('checked', required);

  binding($edit, $textarea, model, $done);
}

function rangeText(min, max) {
  var output = [];
  if (typeof min === 'number') {
    output.push('min: ' + min);
  }
  if (typeof max === 'number') {
    output.push('max: ' + max);
  }
  return output.join(', ') || null;
}

function number_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var userkey = '';
  var placeholder = '';
  var help = '';
  var required = false;
  var min = null;
  var max = null;
  var range = null;
  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    userkey = $('.controls input', $cgr).data('userkey');
    placeholder = $('.controls input', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
    required = $('input', $cgr).prop('required');
    min = Number($('input', $cgr).prop('min'));
    max = Number($('input', $cgr).prop('max'));
    range = rangeText(min, max);
  }

  var $number = $(input.number());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $userkey = $(spec.userkey());
  var $placeholder = $(spec.placeholder());
  var $help = $(spec.help());
  var $min = $(spec.min());
  var $max = $(spec.max());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append(
    $label,
    $userkey,
    $placeholder,
    $help,
    $min,
    $max,
    $required,
    $done
  );
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">number</span></div>'
  ).append($number);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);

  var model = {
    label: label,
    userkey: userkey,
    placeholder: placeholder,
    help: help,
    required: required,
    min: min,
    max: max,
    range: range,
  };

  $('input', $label).val(label);
  $('input', $userkey).val(userkey);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $required).prop('checked', required);
  $('input', $min).val(min);
  $('input', $max).val(max);

  binding($edit, $number, model, $done);
}

function file_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var required = false;
  var userkey = '';
  var help = '';
  if ($cgr) {
    label = $('.control-label span.model-label', $cgr).text();
    required = $('input', $cgr).prop('required');
    userkey = $('.controls input', $cgr).data('userkey');
    help = $('.controls span.help-block', $cgr).text();
  }

  var $upload = $(input.upload());
  var $label = $(spec.label());
  var $required = $(spec.required());
  var $userkey = $(spec.userkey());
  var $help = $(spec.help());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append(
    $label,
    $required,
    $userkey,
    $help,
    $done
  );
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">file</span></div>'
  ).append($upload);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
    $('#output').append($edit);
  }

  var model = {
    label: label,
    required: required,
    userkey: userkey,
    help: help,
  };

  $('input', $label).val(label);
  $('input', $required).prop('checked', required);
  $('input', $userkey).val(userkey);
  $('input', $help).val(help);

  binding($edit, $upload, model, $done);
}

function section_edit($cgr) {
  $('#output .well.spec').remove();
  var legend = 'Section name';
  if ($cgr) {
    legend = $('legend span.label-text', $cgr).text();
  }
  var $section = $(input.section());
  var $legend = $(spec.legend());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($legend, $done);
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">section</span></div>'
  ).append($section);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
    $('#output').append($edit);
  }
  var model = {
    legend: legend,
  };

  $('input', $legend).val(legend);

  binding($edit, $section, model, $done);
}

function rich_edit($cgr) {
  $('#output .well.spec').remove();
  var html = '';
  if ($cgr) {
    html = $('.tinymce', $cgr).html();
  }
  var $rich = $(input.rich());
  var $rich_textarea = $(spec.rich_textarea());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($rich_textarea, $done);
  var $new_cgr = $(
    '<div class="control-group-wrap" data-status="editing"><span class="fe-type">rich</span></div>'
  ).append($rich);
  if ($cgr) {
    $('.tinymce', $rich).html(html);
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
    $('#output').append($edit);
  }
  $('textarea', $rich_textarea).html(html);
  tinymce.init(mce_content);
  $done.click(function(e) {
    e.preventDefault();
    var content = tinymce.activeEditor.getContent();
    if (content === '') {
      // nothing was done
      tinymce.remove();
      $edit.remove();
      $new_cgr.remove();
    } else {
      $('.tinymce', $rich).html(tinymce.activeEditor.getContent());
      tinymce.remove();
      $(this)
        .closest('.spec')
        .remove();
      $rich.closest('.control-group-wrap').removeAttr('data-status');
      var resultParent = $rich[0];
      addSectionNumberToRichInstruction(resultParent);
      updateSectionNumbers();
    }
  });
}

function init() {
  $('#output')
    .find('img')
    .each(function() {
      var $this = $(this);
      if ($this.attr('name')) {
        if ($this.attr('src') === undefined) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if ($this.attr('src').indexOf('http') === 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if (prefix && $this.attr('src').indexOf(prefix) !== 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
      }
    });

  initHtml = $('#output').html();

  // update every 30 seconds
  $.livestamp.interval(30 * 1000);

  rivets.binders['required'] = function(el, value) {
    var attrToSet = 'required';

    if (value) {
      el.setAttribute(attrToSet, value);
    } else {
      // we have to do this for a boolean attribute
      el.removeAttribute(attrToSet);
    }
  };
}

function scrollToBottom() {
  var scrollingElement = document.scrollingElement || document.body;
  scrollingElement.scrollTop = scrollingElement.scrollHeight;
}

function working() {
  $('#add-checkbox').click(function(e) {
    e.preventDefault();
    checkbox_edit();
    scrollToBottom();
  });

  $('#add-radio').click(function(e) {
    e.preventDefault();
    radio_edit();
    scrollToBottom();
  });

  $('#add-text').click(function(e) {
    e.preventDefault();
    text_edit();
    scrollToBottom();
  });

  $('#add-figure').click(function(e) {
    e.preventDefault();
    figure_edit();
    scrollToBottom();
  });

  $('#add-par').click(function(e) {
    e.preventDefault();
    textarea_edit();
    scrollToBottom();
  });

  $('#add-number').click(function(e) {
    e.preventDefault();
    number_edit();
    scrollToBottom();
  });

  $('#add-file').click(function(e) {
    e.preventDefault();
    file_edit();
    scrollToBottom();
  });

  $('#add-rich').click(function(e) {
    e.preventDefault();
    rich_edit();
    scrollToBottom();
  });

  $('#add-section').click(function(e) {
    e.preventDefault();
    section_edit();
    scrollToBottom();
  });

  $('#add-other').click(function(e) {
    e.preventDefault();
    other_edit();
    scrollToBottom();
  });
}

function modalAlert(label, body) {
  $('#modalLabel').html(label);
  $('#modal .modal-body').empty();
  $('#modal .modal-body').append(body);
  $('#modal .modal-footer').html(
    '<button data-dismiss="modal" aria-hidden="true" class="btn">OK</button>'
  );
  $('#modal').modal('show');
}

function cleanBeforeSave() {
  // clean control-focus class and .control-group-buttons element
  $('#output .control-focus').removeClass('control-focus');
  $('#output .control-group-buttons').remove();
  // clean status
  $('#output .control-group-wrap').removeAttr('data-status');
  // remove tinymce
  tinymce.remove();
}

function binding_events() {
  $('#adjust').click(function(e) {
    e.preventDefault();
    if ($(this).text() === 'Adjust location') {
      $(this).text('Done');
      $('#input-items').attr('disabled', true);
      $('#struct-items').attr('disabled', true);
      $('#save').attr('disabled', true);
      $('#preview').attr('disabled', true);
      $('#more').attr('disabled', true);
      $('#output').sortable({
        placeholder: 'ui-state-highlight',
        update: function() {
          updateSectionNumbers();
        },
      });
    } else {
      $(this).text('Adjust location');
      $('#input-items').removeAttr('disabled');
      $('#struct-items').removeAttr('disabled');
      $('#save').removeAttr('disabled');
      $('#preview').removeAttr('disabled');
      $('#more').removeAttr('disabled');
      $('#output').sortable('destroy');
    }
  });
  $('#output').on('mouseenter', '.control-group-wrap', function(e) {
    e.preventDefault();
    // check if it is normal edit mode
    $('.control-group-wrap', '#output').removeClass('control-focus');
    $('.control-group-buttons', '#output').hide();
    if ($('#adjust').text() === 'Adjust location') {
      if (!$(this).hasClass('control-focus')) {
        $(this).addClass('control-focus');
        if ($('.control-group-buttons', $(this)).length) {
          $('.control-group-buttons', $(this)).show();
        } else {
          $(this).prepend(input.button());
        }
      }
    }
  });

  $('#output').on(
    'click',
    '.control-focus a.btn.btn-warning[title="remove"]',
    function(e) {
      e.preventDefault();
      var $cgr = $(this).closest('.control-group-wrap');
      if ($('.control-group-wrap[data-status="editing"]').length) {
        modalAlert(
          'Finish editing first',
          'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.'
        );
        return;
      }
      $cgr.closest('.control-group-wrap').remove();
      updateSectionNumbers();
    }
  );

  $('#output').on('click', '.control-focus a.btn[title="duplicate"]', function(
    e
  ) {
    e.preventDefault();
    var that = this;
    var $cgr = $(this).closest('.control-group-wrap');
    if ($('.control-group-wrap[data-status="editing"]').length) {
      modalAlert(
        'Finish editing first',
        'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.'
      );
      return;
    }
    var cloned = $cgr.clone();
    $('.control-group-buttons', $(cloned)).remove();
    $(cloned).removeClass('control-focus');
    $('input, textarea', $(cloned)).attr('name', UID.generateShort());
    $('input, textarea', $(cloned)).removeAttr('data-userkey');
    $('legend', $(cloned)).attr('id', UID.generateShort());
    $(that)
      .closest('.control-group-wrap')
      .after(cloned);
    updateSectionNumbers();
  });

  $('#output').on('click', '.control-focus a.btn[title="edit"]', function(e) {
    e.preventDefault();
    var $cgr = $(this).closest('.control-group-wrap');
    if (
      $('.control-group-wrap[data-status="editing"]').length &&
      $cgr.attr('data-status') !== 'editing'
    ) {
      modalAlert(
        'Finish editing first',
        'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.'
      );
      return;
    }
    if ($cgr.attr('data-status') === 'editing') {
      // modalAlert('You are still editing it', '');
      return;
    }
    var type = $('span.fe-type', $cgr).text();
    switch (type) {
      case 'rich':
        rich_edit($cgr);
        break;
      case 'checkbox':
        checkbox_edit($cgr);
        break;
      case 'radio':
        radio_edit($cgr);
        break;
      case 'figure':
        figure_edit($cgr);
        break;
      case 'text':
        text_edit($cgr);
        break;
      case 'textarea':
        textarea_edit($cgr);
        break;
      case 'number':
        number_edit($cgr);
        break;
      case 'file':
        file_edit($cgr);
        break;
      case 'section':
        section_edit($cgr);
        break;
      case 'other':
        other_edit($cgr);
        break;
      default:
        console.log('type not implemented.');
    }
  });

  $('#save').click(function(e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      modalAlert(
        'Finish editing first',
        'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.'
      );
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    // var path = window.location.pathname;
    if (html !== initHtml) {
      sendRequest(
        {
          html: html,
        },
        function() {
          window.location.reload(true);
        }
      );
    }
  });

  $('#numbering').click(function(e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      modalAlert(
        'Finish editing first',
        'Please close all the opened edit area by clicking the "Done" button, and then generate the numbering if needed.'
      );
      return;
    }
    cleanBeforeSave();
    addSectionNumbers();
    updateSectionNumbers();
  });

  $('#preview').click(function(e) {
    if ($('#output .well.spec').length) {
      e.preventDefault();
      modalAlert(
        'Save changes first',
        'The form has been changed. Please save it before this action.'
      );
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    if (html !== initHtml) {
      e.preventDefault();
      modalAlert(
        'Save changes first',
        'The form has been changed. Please save it before this action.'
      );
      return;
    }
  });

  $('#saveas').click(function(e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      modalAlert();
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    $('#modalLabel').html('Save the form as (a new one)');
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append(
      '<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Form title</label><div class="controls"><input id="new-title" type="text" class="input"></div></div></form>'
    );
    $('#modal .modal-footer').html(
      '<button value="confirm" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>'
    );
    $('#modal').modal('show');
    $('#modal button[value="confirm"]').click(function() {
      var title = $('#new-title').val();
      sendRequest(
        {
          html: html,
          title: title,
          formType: formType,
        },
        null,
        'saveas'
      );
    });
  });

  $('#submit').click(function(e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      modalAlert(
        'Finish editing first',
        'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.'
      );
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    // var path = window.location.pathname;
    if (html !== initHtml) {
      modalAlert(
        'Save before submit',
        'There are unsaved changes. Please save the changes if needed before submit.'
      );
      return;
    }
    sendRequest(
      {
        status: 0.5,
        version: Number($('#version').text()),
      },
      function() {
        window.location.reload(true);
      },
      'status'
    );
  });

  $('#release').click(function() {
    var html = $('#output').html();
    $('#modalLabel').html('Release the form');
    $('#modal .modal-body').empty();
    var defaultTitle = $('#formtitle').text();
    $('#modal .modal-body').append(
      '<form class="form-horizontal" id="modalform"> <div class="control-group"> <label class="control-label">Form title</label> <div class="controls"><input id="release-title" type="text" value="' +
        defaultTitle +
        '" class="input"> </div> </div> </form>'
    );
    if (formType === 'normal') {
      $('#modal .modal-body').append(
        '<h4>Choose a discrepancy to attach</h4> <table id="discrepancy" class="table table-bordered table-hover"> </table>'
      );
      var discrepancyColumns = [
        selectColumn,
        titleColumn,
        versionColumn,
        releasedOnColumn,
        releasedByColumn,
        releasedFormLinkColumn,
      ];
      fnAddFilterFoot('#discrepancy', discrepancyColumns);
      var discrepancyTable = $('#discrepancy').dataTable({
        sAjaxSource: '/released-forms/discrepancy/json',
        sAjaxDataProp: '',
        bProcessing: true,
        fnDrawCallback: function() {
          Holder.run({
            images: 'img.user',
          });
        },
        oLanguage: {
          sLoadingRecords: 'Please wait - loading data from the server ...',
        },
        aoColumns: discrepancyColumns,
        iDisplayLength: 5,
        aaSorting: [[3, 'desc']],
        sDom: sDomPage,
      });
      selectOneEvent(discrepancyTable);
      filterEvent();
    }
    $('#modal .modal-footer').html(
      '<button value="confirm" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>'
    );
    $('#modal').modal('show');
    $('#modal button[value="confirm"]').click(function() {
      var title = $('#release-title').val();
      var json = {
        title: title,
      };
      if (discrepancyTable) {
        // get only current page after filtered
        var selected = fnGetSelectedInPage(
          discrepancyTable,
          'row-selected',
          true
        );
        if (selected.length === 1) {
          var data = discrepancyTable.fnGetData(selected[0]);
          json.discrepancyFormId = data._id;
        }
      }

      sendRequest(json, null, 'release');
    });
  });

  $('#reject').click(function() {
    sendRequest(
      {
        status: 0,
        version: Number($('#version').text()),
      },
      function() {
        window.location.reload(true);
      },
      'status'
    );
  });

  $('#obsolete, #archive').click(function() {
    sendRequest(
      {
        status: 2,
        version: Number($('#version').text()),
      },
      function() {
        window.location.reload(true);
      },
      'status'
    );
  });
}

$(function() {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  init();
  if (formStatus === 0) {
    working();
  }
  binding_events();
});
