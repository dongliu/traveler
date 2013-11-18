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

$(function() {
  init();
  working();
  binding_events();
});

function init() {}

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
    rich_edit();
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
    var $cgr = $(this).closest('.control-group-wrap');
    // var type = $('span.fe-type', $cgr).text();
    if ($cgr.attr('data-status') == 'editting') {
      return alert('please finish editting first');
    }
    $cgr.closest('.control-group-wrap').remove();
  });
  $('#output').on('click', '.control-focus a.btn[title="duplicate"]', function(e) {
    e.preventDefault();
    var that = this;
    var $cgr = $(this).closest('.control-group-wrap');
    // var type = $('span.fe-type', $cgr).text();
    if ($cgr.attr('data-status') == 'editting') {
      return alert('please finish editting first');
    }
    var cloned = $cgr.clone();
    $('.control-group-buttons', $(cloned)).remove();
    $(cloned).removeClass('control-focus');
    $('input, textarea', $(cloned)).attr('name', UID.generateShort());
    $(that).closest('.control-group-wrap').after(cloned);
  });

  $('#output').on('click', '.control-focus a.btn[title="edit"]', function(e) {
    e.preventDefault();
    var $cgr = $(this).closest('.control-group-wrap');
    if ($cgr.attr('data-status') !== 'editting') {
      var type = $('span.fe-type', $cgr).text();
      switch (type) {
        case 'rich':
          // alert('Please edit it inline.');
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
        default:
          alert('not implemented.');
      }
    }
  });

  $('#save').click(function(e) {
    e.preventDefault();
    if ($('#output .well.spec').length) {
      return alert('please finish the active edit before saving');
    }
    tinymce.remove();
    var html = $('#output').html();
    var path = window.location.pathname;
    if (/^\/forms\/new/.test(path)) {
      $('#modalLabel').html('Save the form');
      $('#modal .modal-body').empty();
      $('#modal .modal-body').append('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Form title</label><div class="controls"><input id="title" type="text" class="input"></div></div></form>');
      $('#modal .modal-footer').html('<button id="action" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
      $('#modal').modal('show');
      $('#action').click(function(e) {
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
        }, function() {
          initHtml = html;
        });
      }
    }
  });

  $('#preview').click(function(e) {
    tinymce.remove();
    var html = $('#output').html();
    if (html !== initHtml) {
      sendRequest({
        html: html
      }, function() {
        initHtml = html;
      });
    }
  });

  $('#rename').click(function(e) {
    e.preventDefault();
    $('#modalLabel').html('Rename the form');
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">New form title</label><div class="controls"><input id="title" type="text" class="input"></div></div></form>');
    $('#modal .modal-footer').html('<button id="action" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
    $('#modal').modal('show');
    $('#action').click(function(e) {
      var newTitle = $('#title').val();
      sendRequest({
        title: newTitle
      }, function() {
        $('#formtitle').text(newTitle);
      });
    });
  });

  $('#saveas').click(function(e) {
    e.preventDefault();
    tinymce.remove();
    var html = $('#output').html();
    $('#modalLabel').html('Save the form as (a new one)');
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Form title</label><div class="controls"><input id="title" type="text" class="input"></div></div></form>');
    $('#modal .modal-footer').html('<button id="action" class="btn btn-primary" data-dismiss="modal">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
    $('#modal').modal('show');
    $('#action').click(function(e) {
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
  }).done(function(json) {
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
        win.focus();
      } else {
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The changes were saved at ' + dateObj.format('HH:mm:ss') + '.</div>');
      }
    }
    if (cb) {
      cb();
    }
  }).fail(function(jqXHR, status, error) {
    $('form#output').fadeTo('slow', 1);
    if (jqXHR.status == 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="/" target="_blank">home</a>, log in, and then save the changes on this page.</div>');
    } else {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>The save request failed. You might need to try again or contact the admin.</div>');
    }
  }).always(function() {});
}

function done_button(view, $out) {
  return function(e) {
    view.unbind();
    $(this).closest('.spec').remove();
    $('input, textarea', $out).attr('name', UID.generateShort());
    $out.closest('.control-group-wrap').removeAttr('data-status');
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
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">checkbox</span></div>').append($checkbox);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
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
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">text</span></div>').append($text);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
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
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">textarea</span></div>').append($textarea);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
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
  var $new_cgr = $('<div class="control-group-wrap" data-status="editting"><span class="fe-type">number</span></div>').append($number);
  if ($cgr) {
    $cgr.replaceWith($new_cgr);
    $new_cgr.after($edit);
  } else {
    $('#output').append($new_cgr);
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
  // tinymce.activeEditor.setContent(html);
  $done.click(function(e) {
    e.preventDefault();
    $('.tinymce', $rich).html(tinymce.activeEditor.getContent());
    tinymce.remove();
    $(this).closest('.spec').remove();
    $rich.closest('.control-group-wrap').removeAttr('data-status');
  });
}


function binding($edit, $out, model, $done) {
  $('input', $edit).keyup(function(e) {
    model[$(this).attr('name')] = $(this).val();
  });
  var view = rivets.bind($out, {
    model: model
  });
  $done.click(done_button(view, $out));
}