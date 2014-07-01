// var mce_content = {
//   inline: true,
//   browser_spellcheck: true,
//   plugins: [
//     ["advlist autolink link image lists charmap print preview hr anchor pagebreak spellchecker"],
//     ["searchreplace wordcount visualblocks visualchars code fullscreen insertdatetime media nonbreaking"],
//     ["save table contextmenu directionality emoticons template paste"]
//   ],
//   toolbar1: "subscript superscript charmap | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image",
//   toolbar2: "undo redo | removeformat | fontselect fontsizeselect | bold italic underline strikethrough",
//   contextmenu: "charmap link image",
//   menubar: false,
//   statusbar: false
// };


var mce_content = {
  selector: 'textarea.tinymce',
  content_css: '/bootstrap/css/bootstrap.css',
  browser_spellcheck: true,
  plugins: [
    ["advlist autolink link image lists charmap hr anchor spellchecker"],
    ["wordcount visualblocks visualchars code media nonbreaking"],
    ["contextmenu directionality paste"]
  ],
  toolbar1: "charmap | link image | undo redo | removeformat | bullist numlist outdent indent | formatselect bold italic underline strikethrough",
  contextmenu: "charmap link image",
  menubar: false,
  statusbar: false
};

$(function () {
  $(document).ajaxError(function (event, jqXHR, settings, exception) {
    if (jqXHR.status == 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="/" target="_blank">home</a>, log in, and then save the changes on this page.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });
  init();
  working();
  binding_events();
});

function init() {}

function working() {
  $('#add-checkbox').click(function (e) {
    e.preventDefault();
    checkbox_edit();
  });


  $('#add-text').click(function (e) {
    e.preventDefault();
    text_edit();
  });

  $('#add-par').click(function (e) {
    e.preventDefault();
    textarea_edit();
  });

  $('#add-number').click(function (e) {
    e.preventDefault();
    number_edit();
  });

  $('#add-file').click(function (e) {
    e.preventDefault();
    file_edit();
  });

  $('#add-rich').click(function (e) {
    e.preventDefault();
    rich_edit();
  });

  $('#add-section').click(function (e) {
    e.preventDefault();
    section_edit();
  });


  $('#add-other').click(function (e) {
    e.preventDefault();
    other_edit();
  });
}

function modalAlert(label, body) {
  $('#modalLabel').html(label);
  $('#modal .modal-body').empty();
  $('#modal .modal-body').append(body);
  $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">OK</button>');
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
  $('#adjust').click(function (e) {
    if ($(this).text() == 'Adjust location') {
      $(this).text('Done');
      $('#input-items').attr('disabled', true);
      $('#struct-items').attr('disabled', true);
      $('#save').attr('disabled', true);
      $('#preview').attr('disabled', true);
      $('#more').attr('disabled', true);
      $('#output').sortable({
        placeholder: "ui-state-highlight"
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
    e.preventDefault();
  });
  $('#output').on('mouseenter', '.control-group-wrap', function (e) {
    e.preventDefault();
    // check if it is normal edit mode
    $('.control-group-wrap', '#output').removeClass('control-focus');
    $('.control-group-buttons', '#output').hide();
    if ($('#adjust').text() == 'Adjust location') {
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

  $('#output').on('click', '.control-focus a.btn.btn-warning[title="remove"]', function (e) {
    e.preventDefault();
    var $cgr = $(this).closest('.control-group-wrap');
    if ($('.control-group-wrap[data-status="editting"]').length) {
      modalAlert('Finish editting first', 'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.');
      return;
    }
    $cgr.closest('.control-group-wrap').remove();
  });

  $('#output').on('click', '.control-focus a.btn[title="duplicate"]', function (e) {
    e.preventDefault();
    var that = this;
    var $cgr = $(this).closest('.control-group-wrap');
    if ($('.control-group-wrap[data-status="editting"]').length) {
      modalAlert('Finish editting first', 'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.');
      return;
    }
    var cloned = $cgr.clone();
    $('.control-group-buttons', $(cloned)).remove();
    $(cloned).removeClass('control-focus');
    $('input, textarea', $(cloned)).attr('name', UID.generateShort());
    $('legend', $(cloned)).attr('id', UID.generateShort());
    $(that).closest('.control-group-wrap').after(cloned);
  });

  $('#output').on('click', '.control-focus a.btn[title="edit"]', function (e) {
    e.preventDefault();
    var $cgr = $(this).closest('.control-group-wrap');
    if ($('.control-group-wrap[data-status="editting"]').length && $cgr.attr('data-status') !== 'editting') {
      modalAlert('Finish editting first', 'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.');
      return;
    }
    if ($cgr.attr('data-status') == 'editting') {
      // modalAlert('You are still editting it', '');
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
      alert('not implemented.');
    }
  });

  $('#save').click(function (e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      modalAlert('Finish editting first', 'Please close all the opened edit area by clicking the "Done" button, and save the changes if needed.');
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    var path = window.location.pathname;
    if (/^\/forms\/new/.test(path)) {
      $('#modalLabel').html('Save the form');
      $('#modal .modal-body').empty();
      $('#modal .modal-body').append('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Form title</label><div class="controls"><input id="title" type="text" class="input"></div></div></form>');
      $('#modal .modal-footer').html('<button id="action" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
      $('#modal').modal('show');
      $('#action').click(function (e) {
        sendRequest({
          title: $('#title').val(),
          html: html
        });
      });
    } else {
      if (html == initHtml) {
        // do not bother to inform the user
      } else {
        sendRequest({
          html: html
        }, function () {
          initHtml = html;
        });
      }
    }
  });

  $('#preview').click(function (e) {
    if ($('#output .well.spec').length) {
      e.preventDefault();
      modalAlert('Save changes first', 'The form has been changed. Please save it before this action.');
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    if (html !== initHtml) {
      e.preventDefault();
      modalAlert('Save changes first', 'The form has been changed. Please save it before this action.');
      return;
    }
  });

  $('#rename').click(function (e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      modalAlert();
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    if (html !== initHtml) {
      e.preventDefault();
      modalAlert('Save changes first', 'The form has been changed. Please save it before this action.');
      return;
    }
    $('#modalLabel').html('Rename the form');
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">New form title</label><div class="controls"><input id="title" type="text" class="input"></div></div></form>');
    $('#modal .modal-footer').html('<button id="action" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
    $('#modal').modal('show');
    $('#action').click(function (e) {
      var newTitle = $('#title').val();
      sendRequest({
        title: newTitle
      }, function () {
        $('#formtitle').text(newTitle);
      });
    });
  });

  $('#saveas').click(function (e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      modalAlert();
      return;
    }
    cleanBeforeSave();
    var html = $('#output').html();
    $('#modalLabel').html('Save the form as (a new one)');
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Form title</label><div class="controls"><input id="title" type="text" class="input"></div></div></form>');
    $('#modal .modal-footer').html('<button id="action" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
    $('#modal').modal('show');
    $('#action').click(function (e) {
      var title = $('#title').val();
      sendRequest({
        html: html,
        title: title
      }, null, true);
    });
  });

}

function sendRequest(data, cb, saveas) {
  var path = window.location.pathname;
  var url, type;
  if (saveas) {
    url = '/forms/';
    type = 'POST';
  } else {
    if (/^\/forms\/new/.test(path)) {
      $('form#output').fadeTo('slow', 0.2);
      url = '/forms/';
      type = 'POST';
    } else {
      url = path;
      type = 'PUT';
    }
  }
  var formRequest = $.ajax({
    url: url,
    type: type,
    async: true,
    data: JSON.stringify(data),
    contentType: 'application/json',
    processData: false,
    dataType: 'json'
  }).done(function (json) {
    var location;
    if (/^\/forms\/new/.test(path)) {
      location = formRequest.getResponseHeader('Location');
      document.location.href = location;
      // document.location.href = json.location;
    } else {
      var timestamp = formRequest.getResponseHeader('Date');
      var dateObj = moment(timestamp);
      if (saveas) {
        location = formRequest.getResponseHeader('Location');
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The new form is created at <a href="' + location + '">' + json.location + '</a></div>');
        var win = window.open(location, '_blank');
        if (win) {
          win.focus();
        }
      } else {
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The changes were saved at ' + dateObj.format('HH:mm:ss') + '.</div>');
      }
    }
    if (cb) {
      cb();
    }
  }).fail(function (jqXHR, status, error) {
    $('form#output').fadeTo('slow', 1);
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>The save request failed. You might need to try again or contact the admin.</div>');
    }
  }).always(function () {});
}

function done_button(view, $out) {
  return function (e) {
    view.unbind();
    $(this).closest('.spec').remove();
    $('input, textarea', $out).each(function () {
      if (!$(this).attr('name')) {
        $(this).attr('name', UID.generateShort());
      }
    });
    // $('input, textarea', $out).attr('name', UID.generateShort());
    $('legend', $out).each(function () {
      if (!$(this).attr('id')) {
        $(this).attr('id', UID.generateShort());
      }
    });
    // $('legend', $out).attr('id', UID.generateShort());
    $out.closest('.control-group-wrap').removeAttr('data-status');
    e.preventDefault();
  };
}

function add_new_cgr($cgr, $new_cgr, $buttons, $edit) {
  // var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">text</span></div>').append($comp);
  $new_cgr.prepend($buttons.hide());
  if ($cgr) {
    // reserve important attributes that are not covered but rivet model binding like unique name
    $('input', $new_cgr).attr('name', $('input', $cgr).attr('name'));
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
    $('#output').append($edit);
  }
}

function checkbox_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var checkbox_text = 'checkbox text';
  var required = false;
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    checkbox_text = $('.controls label span', $cgr).text();
    required = $('input', $cgr).prop('required');
  }
  var $checkbox = $(input.checkbox());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $checkbox_text = $(spec.checkbox_text());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $checkbox_text, $required, $done);
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">checkbox</span></div>').append($checkbox);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  var model = {
    label: label,
    checkbox_text: checkbox_text,
    required: required
  };
  $('input', $label).val(label);
  $('input', $checkbox_text).val(checkbox_text);
  $('input', $required).prop('checked', required);

  binding($edit, $checkbox, model, $done);
}

function text_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var placeholder = '';
  var help = '';
  var required = false;
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    placeholder = $('.controls input', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
    required = $('.controls input', $cgr).prop('required');
  }
  var $text = $(input.text());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $placeholder = $(spec.placeholder());
  var $help = $(spec.help());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $placeholder, $help, $required, $done);
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">text</span></div>').append($text);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);
  var model = {
    label: label,
    placeholder: placeholder,
    help: help,
    required: required
  };
  $('input', $label).val(label);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $required).prop('checked', required);
  binding($edit, $text, model, $done);
}

function other_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var placeholder = '';
  var help = '';
  var type = 'text';
  var required = false;
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    placeholder = $('.controls input', $cgr).attr('placeholder');
    type = $('.controls input', $cgr).attr('type');
    help = $('.controls span.help-block', $cgr).text();
    required = $('input', $cgr).prop('required');
  }
  var $other = $(input.other());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $placeholder = $(spec.placeholder());
  var $type = $(spec.type());
  var $help = $(spec.help());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($type, $label, $placeholder, $help, $required, $done);
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">other</span></div>').append($other);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);

  var model = {
    label: label,
    placeholder: placeholder,
    type: type,
    help: help,
    required: required
  };
  $('input', $label).val(label);
  $('select', $type).val(type);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $required).prop('checked', required);

  binding($edit, $other, model, $done);
}


function textarea_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var placeholder = '';
  var rows = 3;
  var help = '';
  var required = false;

  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    placeholder = $('.controls textarea', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
    rows = $('.controls textarea', $cgr).attr('rows');
    required = $('textarea', $cgr).prop('required');
  }

  var $textarea = $(input.textarea());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $placeholder = $(spec.placeholder());
  var $rows = $(spec.rows());
  var $help = $(spec.help());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $placeholder, $rows, $help, $required, $done);
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">textarea</span></div>').append($textarea);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);

  var model = {
    label: label,
    placeholder: placeholder,
    rows: rows,
    help: help,
    required: required
  };

  $('input', $label).val(label);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $rows).val(rows);
  $('input', $required).prop('checked', required);

  binding($edit, $textarea, model, $done);
}


function number_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var placeholder = '';
  var help = '';
  var required = false;
  var min = '';
  var max = '';
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    placeholder = $('.controls input', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
    required = $('input', $cgr).prop('required');
    min = $('input', $cgr).prop('min');
    max = $('input', $cgr).prop('max');
  }

  var $number = $(input.number());
  var $buttons = $(input.button());
  var $label = $(spec.label());
  var $placeholder = $(spec.placeholder());
  var $help = $(spec.help());
  var $min = $(spec.min());
  var $max = $(spec.max());
  var $required = $(spec.required());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $placeholder, $help, $min, $max, $required, $done);
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">number</span></div>').append($number);
  add_new_cgr($cgr, $new_cgr, $buttons, $edit);

  var model = {
    label: label,
    placeholder: placeholder,
    help: help,
    required: required,
    min: min,
    max: max
  };

  $('input', $label).val(label);
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
  var help = '';
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    help = $('.controls span.help-block', $cgr).text();
  }

  var $upload = $(input.upload());
  var $label = $(spec.label());
  var $help = $(spec.help());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $help, $done);
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">file</span></div>').append($upload);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
    $('#output').append($edit);
  }

  var model = {
    label: 'label',
    help: ''
  };

  $('input', $label).val(label);
  $('input', $help).val(help);

  binding($edit, $upload, model, $done);
}

function section_edit($cgr) {
  $('#output .well.spec').remove();
  var legend = 'Section name';
  if ($cgr) {
    legend = $('legend', $cgr).text();
  }
  var $section = $(input.section());
  var $legend = $(spec.legend());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($legend, $done);
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">section</span></div>').append($section);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
    $('#output').append($edit);
  }
  var model = {
    legend: legend
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
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">rich</span></div>').append($rich);
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
  $done.click(function (e) {
    e.preventDefault();
    $('.tinymce', $rich).html(tinymce.activeEditor.getContent());
    tinymce.remove();
    $(this).closest('.spec').remove();
    $rich.closest('.control-group-wrap').removeAttr('data-status');
  });
}


function binding($edit, $out, model, $done) {
  $('input:text', $edit).keyup(function (e) {
    model[$(this).attr('name')] = $(this).val();
  });

  $('input[type="number"]', $edit).on('input', function (e) {
    model[$(this).attr('name')] = $(this).val();
  });

  $('select', $edit).change(function (e) {
    model[$(this).attr('name')] = $(this).val();
  });

  $('input:checkbox', $edit).change(function (e) {
    model[$(this).attr('name')] = $(this).prop('checked');
  });

  var view = rivets.bind($out, {
    model: model
  });

  $done.click(done_button(view, $out));
}
