var mce_head = {
  inline: true,
  browser_spellcheck: true,
  plugins: "charmap",
  toolbar: "undo redo | subscript superscript charmap",
  menubar: false,
  statusbar: false
};

var mce_content = {
  inline: true,
  browser_spellcheck: true,
  plugins: [
    ["advlist autolink link image lists charmap print preview hr anchor pagebreak spellchecker"],
    ["searchreplace wordcount visualblocks visualchars code fullscreen insertdatetime media nonbreaking"],
    ["save table contextmenu directionality emoticons template paste"]
  ],
  toolbar1: "subscript superscript charmap | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image",
  toolbar2: "undo redo | removeformat | fontselect fontsizeselect | bold italic underline strikethrough",
  contextmenu: "charmap link image",
  menubar: false,
  statusbar: false
};

$(function() {
  init();
  working();
  binding_events();
});

function init() {
  // $('#form-title h3.tinymce').tinymce(mce_head);
  // $('#form-title p.tinymce').tinymce(mce_content);
  $('.control-group.output-control-group[data-type="rich"]').tinymce(mce_content);
}

function working() {
  $('#add-checkbox').click(function(e) {
    e.preventDefault();
    checkbox_edit();
  });


  $('#add-text').click(function(e) {
    e.preventDefault();
    text_edit();
  });

  $('#add-par').click(function(e) {
    e.preventDefault();
    textarea_edit();
  });

  $('#add-number').click(function(e) {
    e.preventDefault();
    number_edit();
  });

  $('#add-file').click(function(e) {
    e.preventDefault();
    file_edit();
  });

  $('#add-rich').click(function(e) {
    e.preventDefault();
    $('#output .well.spec').remove();
    var $rich = $(input.rich());
    $('#output').append($('<div class="control-group-wrap" data-type="rich"></div>').append($rich));
    $rich.tinymce(mce_content);
  });

  //   $('#add-hold').click(function(e){
  //     clean_ko();
  //     $('#add-item-form').empty();
  //     $('#add-item-form').show();
  //     var legend = $('#legend legend').clone().text('Add hold point').show();
  //     var hold = $('#hold .control-group').clone().show();
  //     var button = $('#button .form-actions').clone().show();
  //     $('#add-item-form').append(legend);
  //     $('#add-item-form').append(hold);
  //     $('#add-item-form').append(button);

  //     // the output part
  //     var element = $('#hold-element .control-group').clone().show();
  //     element.prepend($('#control-group-buttons .btn-group').clone());
  //     $('#output').append(element);
  //     $('input', hold).attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
  //     $('.holder span', element).attr("data-bind", "text: label");
  //     var formModel = function (init) {
  //       this.label = ko.observable(init);
  //     };
  //     ko.applyBindings(new formModel("Name"));
  //     binding_button();
  //     e.preventDefault();
  //   });

  $('#add-section').click(function(e) {
    e.preventDefault();
    section_edit();
  });


  //   $('#add-page').click(function(e){
  //     e.preventDefault();
  //   });

}

function binding_events() {
  $('#adjust').click(function(e) {
    if ($(this).text() == 'Adjust location') {
      $(this).text('Done');
      $('#input-items').attr('disabled', true);
      $('#struct-items').attr('disabled', true);
      $('#save').attr('disabled', true);
      $('#output').sortable({
        placeholder: "ui-state-highlight"
      });
    } else {
      $(this).text('Adjust location');
      $('#input-items').removeAttr('disabled');
      $('#struct-items').removeAttr('disabled');
      $('#save').removeAttr('disabled');
      $('#output').sortable('destroy');
    }
    e.preventDefault();
  });
  $('#output').on('mouseenter', '.control-group-wrap', function(e) {
    e.preventDefault();
    if (!$(this).hasClass('control-focus')) {
      $(this).addClass('control-focus');
      $(this).prepend(input.button());
    }
  });
  $('#output').on('mouseleave', '.control-group-wrap', function(e) {
    e.preventDefault();
    if ($(this).hasClass('control-focus')) {
      $(this).removeClass('control-focus');
      $('.control-group-buttons', $(this)).remove();
    }
  });
  $('#output').on('click', '.control-focus a.btn.btn-warning[title="remove"]', function(e) {
    e.preventDefault();
    $(this).closest('.control-group-wrap').remove();
  });
  $('#output').on('click', '.control-focus a.btn[title="duplicate"]', function(e) {
    e.preventDefault();
    var that = this;
    var cloned = $(that).closest('.control-group-wrap').clone();
    $('.control-group-buttons', $(cloned)).remove();
    $(cloned).removeClass('control-focus');
    $(that).closest('.control-group-wrap').after(cloned);
  });

  $('#output').on('click', '.control-focus a.btn[title="edit"]', function(e) {
    e.preventDefault();
    var $cgr = $(this).closest('.control-group-wrap');
    var type = $cgr.attr('data-type');
    switch (type) {
      case 'rich':
        alert('Please edit it inline.');
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
      default:
        alert('not implemented.');
    }
  });

  $('#save').click(function(e){
    $('#output .well.spec').remove();
    tinymce.remove();
    var html = $('#output').html();
    $('#modalLabel').html('Save the form');
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Form title</label><div class="controls"><input id="title" type="text" class="input"></div></div></form>');
    $('#modal .modal-footer').html('<button id="action" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
    $('#modal').modal('show');
    $('#action').click(function(e) {
      sendRequest({title: $('#title').val(), html: html});
    });
  });

}

function sendRequest(data) {
  var path = window.location.pathname;
  var url, type;
  if (/^\/forms\/new/.test(path)) {
    url = '/forms';
    type = 'POST';
  } else {
    url = path;
    type = 'PUT';
  }
  $('form#output').fadeTo('slow', 0.2);
  var formRequest = $.ajax({
    url: url,
    type: type,
    async: true,
    data: JSON.stringify(data),
    contentType: 'application/json',
    processData: false,
    dataType: 'json'
  }).done(function(json) {
    if (/^\/forms\/new/.test(path)) {
      var location = formRequest.getResponseHeader('Location');
      document.location.href = location;
      // document.location.href = json.location;
    } else {
      var timestamp = formRequest.getResponseHeader('Date');
      var dateObj = moment(timestamp);
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The changes were saved at ' + dateObj.format('HH:mm:ss') + '.</div>');
    }
  }).fail(function(jqXHR, status, error) {
    // TODO change to modal
    alert('The save request failed. You might need to try again or contact the admin.');
  }).always(function() {
    $('form#output').fadeTo('slow', 1);
    // recover mce editors
    init();
  });
}

function done_button(view) {
  return function(e) {
    view.unbind();
    $(this).closest('.spec').remove();
    e.preventDefault();
  };
}

function checkbox_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var checkbox_text = 'checkbox text';
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    checkbox_text = $('.controls label span', $cgr).text();
  }
  var $checkbox = $(input.checkbox());
  var $label = $(spec.label());
  var $checkbox_text = $(spec.checkbox_text());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $checkbox_text, $done);
  if ($cgr) {
    var $new_cgr = $('<div class="control-group-wrap" data-type="checkbox"><span class="fe-type">checkbox</span></div>').append($checkbox);
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($('<div class="control-group-wrap" data-type="checkbox"><span class="fe-type">checkbox</span></div>').append($checkbox));
    $('#output').append($edit);
  }
  var model = {
    label: label,
    checkbox_text: checkbox_text
  };
  $('input', $label).val(label);
  $('input', $checkbox_text).val(checkbox_text);

  binding($edit, $checkbox, model, $done);
}

function text_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var placeholder = '';
  var help = '';
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    placeholder = $('.controls input', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
  }
  var $text = $(input.text());
  var $label = $(spec.label());
  var $placeholder = $(spec.placeholder());
  var $help = $(spec.help());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $placeholder, $help, $done);
  if ($cgr) {
    var $new_cgr = $('<div class="control-group-wrap" data-type="text"></div>').append($text);
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($('<div class="control-group-wrap" data-type="text"></div>').append($text));
    $('#output').append($edit);
  }

  var model = {
    label: label,
    placeholder: placeholder,
    help: help
  };
  $('input', $label).val(label);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);

  binding($edit, $text, model, $done);
}


function textarea_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var placeholder = '';
  var rows = 3;
  var help = '';

  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    placeholder = $('.controls textarea', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
    rows = $('.controls textarea', $cgr).attr('rows');
  }

  var $textarea = $(input.textarea());
  var $label = $(spec.label());
  var $placeholder = $(spec.placeholder());
  var $rows = $(spec.rows());
  var $help = $(spec.help());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $placeholder, $rows, $help, $done);
  if ($cgr) {
    var $new_cgr = $('<div class="control-group-wrap" data-type="textarea"></div>').append($textarea);
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($('<div class="control-group-wrap" data-type="textarea"></div>').append($textarea));
    $('#output').append($edit);
  }
  var model = {
    label: label,
    placeholder: placeholder,
    rows: rows,
    help: help
  };

  $('input', $label).val(label);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);
  $('input', $rows).val(rows);

  binding($edit, $textarea, model, $done);
}


function number_edit($cgr) {
  $('#output .well.spec').remove();
  var label = 'label';
  var placeholder = '';
  var help = '';
  if ($cgr) {
    label = $('.control-label span', $cgr).text();
    placeholder = $('.controls input', $cgr).attr('placeholder');
    help = $('.controls span.help-block', $cgr).text();
  }

  var $number = $(input.number());
  var $label = $(spec.label());
  var $placeholder = $(spec.placeholder());
  var $help = $(spec.help());
  var $done = $(spec.done());
  var $edit = $('<div class="well spec"></div>').append($label, $placeholder, $help, $done);

  if ($cgr) {
    var $new_cgr = $('<div class="control-group-wrap" data-type="number"></div>').append($number);
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($('<div class="control-group-wrap" data-type="number"></div>').append($number));
    $('#output').append($edit);
  }

  var model = {
    label: label,
    placeholder: placeholder,
    help: help
  };

  $('input', $label).val(label);
  $('input', $placeholder).val(placeholder);
  $('input', $help).val(help);

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

  if ($cgr) {
    var $new_cgr = $('<div class="control-group-wrap" data-type="file"></div>').append($upload);
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($('<div class="control-group-wrap" data-type="file"></div>').append($upload));
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
  if ($cgr) {
    var $new_cgr = $('<div class="control-group-wrap" data-type="section"></div>').append($section);
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($('<div class="control-group-wrap" data-type="section"></div>').append($section));
    $('#output').append($edit);
  }
  var model = {
    legend: legend
  };

  $('input', $legend).val(legend);

  binding($edit, $section, model, $done);
}


function binding($edit, $out, model, $done) {
  $('input', $edit).keyup(function(e) {
    model[$(this).attr('name')] = $(this).val();
  });
  var view = rivets.bind($out, {
    model: model
  });
  $done.click(done_button(view));
}