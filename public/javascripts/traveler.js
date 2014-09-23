/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, Modernizr: false*/
/*global travelerStatus: true, finishedInput: true*/

function livespan(stamp) {
  return '<span data-livestamp="' + stamp + '"></span>';
}


function history(found) {
  var i, output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = output + 'changed to <strong>' + found[i].value + '</strong> by ' + found[i].inputBy + ' ' + moment(found[i].inputOn).fromNow() + '; ';
    }
  }
  return output;
}

function fileHistory(found) {
  var i,
    output = '',
    link;
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      link = '/data/' + found[i]._id;
      output = output + '<strong><a href=' + link + ' target="_blank">' + found[i].value + '</a></strong> uploaded by ' + found[i].inputBy + ' ' + moment(found[i].inputOn).fromNow() + '; ';
    }
  }
  return output;
}

function notes(found) {
  var i, output = '<dl>';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = output + '<dt><b>' + found[i].inputBy + ' noted ' + moment(found[i].inputOn).fromNow() + '</b>: </dt>';
      output = output + '<dd>' + found[i].value + '</dd>';
    }
  }
  return output + '</dl>';
}


// temparary solution for the dirty forms
function cleanForm() {
  $('.control-group-buttons').remove();
}

// handle browsers not supporting date type input
function dateSupport() {
  if (!Modernizr.inputtypes.date) {
    $('input[type="date"]').datepicker({
      format: 'yyyy-mm-dd'
    });
  }
}

function setStatus(s) {
  $.ajax({
    url: './status',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      status: s
    })
  }).done(function (data, status, jqXHR) {
    document.location.href = window.location.pathname;
  }).fail(function (jqXHR, status, error) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();
}

function createSideNav() {
  var $legend = $('legend');
  var $affix = $('<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>');
  var $toggle = $('<div class="sidenavtoggle"><a id="toggle" class="btn btn-primary" data-toggle="tooltip" title="show/hide side nav"><i class="fa fa-anchor fa-lg"></i></a></div>');
  var i;
  if ($legend.length > 1) {
    for (i = 0; i < $legend.length; i += 1) {
      $affix.append('<li><a href="#' + $legend[i].id + '">' + $legend[i].textContent + '</a></li>');
    }
    $('body').append($('<div id="affixlist" class="bs-docs-sidebar"></div>').append($affix));
    $('body').attr('data-spy', 'scroll');
    $('body').attr('data-target', '#affixlist');
    $('#affixlist').hide();
    $('body').append($toggle);
    $('#toggle').click(function (e) {
      e.preventDefault();
      $('#affixlist').toggle();
    });
  }
}

function updateFinished(num) {
  $.ajax({
    url: './finishedinput',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      finishedInput: num
    })
  }).done(function (data, status, jqXHR) {}).fail(function (jqXHR, status, error) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update finished input number</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();
}

function validation_message(form) {
  var i = 0,
    output = $('<div>'),
    p,
    value,
    input,
    label,
    span;
  for (i = 0; i < form.elements.length; i += 1) {
    input = form.elements[i];
    p = $('<p>');
    span = $('<span class="validation">');
    if (input.checkValidity()) {
      p.css('color', '#468847');
      span.css('color', '#468847');
    } else {
      p.css('color', '#b94a48');
      span.css('color', '#b94a48');
    }
    if (input.type === 'checkbox') {
      value = input.checked ? 'checked' : 'not checked';
    } else {
      if (input.value === '') {
        value = 'no input from user';
      } else {
        value = input.value;
      }
    }
    label = $(input).closest('.control-group').children('.control-label').text();
    if (input.checkValidity()) {
      p.html('<b>' + label + '</b>: ' + value);
      span.text('validation passed');
    } else {
      p.html('<b>' + label + '</b>: ' + value + ' | Message: ' + input.validationMessage);
      span.text(input.validationMessage);
    }
    $(input).closest('.controls').append(span);
    output.append(p);
  }
  return output;
}

$(function () {

  $(document).ajaxError(function (event, jqXHR, settings, exception) {
    if (jqXHR.status === 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="/" target="_blank">home</a>, log in, and then save the changes on this page.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });

  createSideNav();

  cleanForm();

  // update every 30 seconds
  $.livestamp.interval(30 * 1000);

  $(document).bind('drop dragover', function (e) {
    e.preventDefault();
  });

  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });

  dateSupport();

  var binder = new Binder.FormBinder(document.forms[0]);

  function renderNotes() {
    $.ajax({
      url: './notes/',
      type: 'GET',
      dataType: 'json'
    }).done(function (data, status, jqXHR) {
      $('#form input,textarea').each(function (index, element) {
        var found = data.filter(function (e) {
          return e.name === element.name;
        });
        $(element).closest('.controls').append('<div class="note-buttons"><b>notes</b>: <a class="notes-number" href="#" data-toggle="tooltip" title="show/hide notes"><span class="badge badge-info">' + found.length + '</span></a> <a class="new-note" href="#" data-toggle="tooltip" title="new note"><i class="fa fa-file-o fa-lg"></i></a></div>');
        if (found.length) {
          found.sort(function (a, b) {
            if (a.inputOn > b.inputOn) {
              return -1;
            }
            return 1;
          });
          $(element).closest('.controls').append('<div class="input-notes" style="display: none;">' + notes(found) + '</div>');
        }
      });

    }).fail(function (jqXHR, status, error) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    }).always();
  }

  $('#form').on('click', 'a.new-note', function (e) {
    e.preventDefault();
    var $that = $(this);
    $('#modalLabel').html('Add new note');
    $('#modal .modal-body').html('<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Note: </label><div class="controls"><textarea name="note-content" rows=5></textarea><input type="hidden" name="inputname" value="' + $(this).closest('.controls').find('input').prop('name') + '"></div></div></form>');
    $('#modal .modal-footer').html('<button value="submit" class="btn btn-primary" data-dismiss="modal">Submit</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
    $('#modal').modal('show');
    $('#modal button[value="submit"]').click(function (e) {
      var name = $('#modal input[name="inputname"]').val();
      var value = $('#modal textarea[name="note-content"]').val();
      e.preventDefault();
      $.ajax({
        url: './notes/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          name: name,
          value: value
        })
      }).done(function (data, status, jqXHR) {
        var timestamp = jqXHR.getResponseHeader('Date');
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Note saved ' + livespan(timestamp) + '</div>');
        var $notes_number = $that.closest('.controls').find('a.notes-number span.badge');
        $notes_number.text(parseInt($notes_number.text(), 10) + 1);

        // add new note
        if ($that.closest('.controls').find('.input-notes').length) {
          $that.closest('.controls').find('.input-notes dl').prepend('<dt><b>You noted ' + livespan(timestamp) + '</b>: </dt><dd>' + value + '</dd>');
        } else {
          $that.closest('.controls').append('<div class="input-notes"><dl><dt><b>You noted ' + livespan(timestamp) + '</b>: </dt><dd>' + value + '</dd></dl></div>');
        }

        $.livestamp.resume();

      }).fail(function (jqXHR, status, error) {
        if (jqXHR.status !== 401) {
          $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot save the note: ' + jqXHR.responseText + '</div>');
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      }).always(function () {});
    });
  });

  $('#form').on('click', 'a.notes-number', function (e) {
    e.preventDefault();
    var $input_notes = $(this).closest('.controls').find('.input-notes');
    if ($input_notes.is(':visible')) {
      $input_notes.hide();
    } else {
      $input_notes.show();
    }
  });

  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json'
  }).done(function (data, status, jqXHR) {
    $('#form input,textarea').each(function (index, element) {
      var found = data.filter(function (e) {
        return e.name === element.name;
      });
      if (found.length) {
        found.sort(function (a, b) {
          if (a.inputOn > b.inputOn) {
            return -1;
          }
          return 1;
        });
        if (this.type === 'file') {
          $(element).closest('.controls').append('<div class="input-history"><b>history</b>: ' + fileHistory(found) + '</div>');
        } else {
          binder.deserializeFieldFromValue(element, found[0].value);
          binder.accessor.set(element.name, found[0].value);
          $(element).closest('.controls').append('<div class="input-history"><b>history</b>: ' + history(found) + '</div>');
        }
      }
    });

    // check if active here
    if (travelerStatus === 1) {
      $('#form input,textarea').removeAttr('disabled');
    }

    // load the notes here
    renderNotes();

  }).fail(function (jqXHR, status, error) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();

  $('#complete').click(function (e) {
    e.preventDefault();
    $('#form input,textarea').attr('disabled', true);
    setStatus(1.5);
  });

  // deserialize the values here
  $('#form .control-group-wrap').mouseenter(function (e) {
    e.preventDefault();
    if (!$(this).hasClass('control-focus')) {
      $(this).addClass('control-focus');
    }
  });
  $('#form .control-group-wrap').mouseleave(function (e) {
    e.preventDefault();
    if ($(this).hasClass('control-focus')) {
      $(this).removeClass('control-focus');
    }
  });

  $('#form input:not([type="file"], [type="checkbox"]),textarea').on('input', function (e) {
    var $this = $(this);
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea').not($this).attr('disabled', true);
    $('#completed').attr('disabled', true);
    if ($cgw.children('.control-group-buttons').length === 0) {
      $cgw.prepend('<div class="pull-right control-group-buttons"><button value="save" class="btn btn-primary">Save</button> <button value="reset" class="btn">Reset</button></div>');
    }
  });

  $('#form input:not([type="file"])').change(function (e) {
    var $this = $(this);
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea').not($this).attr('disabled', true);
    $('#completed').attr('disabled', true);
    if ($cgw.children('.control-group-buttons').length === 0) {
      $cgw.prepend('<div class="pull-right control-group-buttons"><button value="save" class="btn btn-primary">Save</button> <button value="reset" class="btn">Reset</button></div>');
    }
  });


  $('#form').on('click', 'button[value="save"]', function (e) {
    e.preventDefault();
    // ajax to save the current value
    var $this = $(this);
    var input = $this.closest('.control-group-wrap').find('input,textarea')[0];
    binder.serializeField(input);
    $.ajax({
      url: './data/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        name: input.name,
        type: input.type,
        value: binder.accessor.target[input.name]
      })
    }).done(function (data, status, jqXHR) {
      var timestamp = jqXHR.getResponseHeader('Date');
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Change saved ' + livespan(timestamp) + '</div>');
      var $history = $this.closest('.control-group-wrap').find('.input-history');
      if ($history.length) {
        $history = $($history[0]);
      } else {
        // add an input-history div
        finishedInput += 1;
        updateFinished(finishedInput);
        $history = $('<div class="input-history"/>').appendTo($this.closest('.control-group-wrap').find('.controls'));
      }
      $history.html('changed to <strong>' + binder.accessor.target[input.name] + '</strong> by you ' + livespan(timestamp) + '; ' + $history.html());
      $.livestamp.resume();
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR, status, error) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the value: ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    }).always(function () {
      $('#form input,textarea').removeAttr('disabled');
      $('#complete').removeAttr('disabled');
    });

  });


  $('#form').on('click', 'button[value="reset"]', function (e) {
    e.preventDefault();
    var $this = $(this);
    var input = $this.closest('.control-group-wrap').find('input,textarea')[0];
    if (binder.accessor.target[input.name] === undefined) {
      if ($(input).is(':checkbox')) {
        $(input).prop('checked', false);
      } else {
        $(input).val('');
      }
    } else {
      binder.deserializeField(input);
    }
    $('#form input,textarea').removeAttr('disabled');
    $('#complete').removeAttr('disabled');
    $(this).closest('.control-group-buttons').remove();
  });

  $('#form input:file').change(function (e) {
    e.preventDefault();
    var $this = $(this);
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea').not($this).attr('disabled', true);
    $('#completed').attr('disabled', true);
    var file = this.files[0];
    if (file === undefined) {
      $cgw.children('.control-group-buttons').remove();
      return;
    }

    var $validation = $cgw.find('.validation');
    if ($validation.length) {
      $validation = $($validation[0]);
    } else {
      $validation = $('<div class="validation"></div>').appendTo($cgw.find('.controls'));
    }
    if (!(/^(image|text)\//i.test(file.type) || file.type === 'application/pdf' || file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      $validation.html('<p class="text-error">' + file.type + ' is not allowed to upload</p>');
      $cgw.children('.control-group-buttons').remove();
      return;
    }
    if (file.size > 5000000) {
      $validation.html('<p class="text-error">' + file.size + ' is too large to upload</p>');
      $cgw.children('.control-group-buttons').remove();
      return;
    }
    // clear validation message if any
    $validation.empty();

    if ($cgw.children('.control-group-buttons').length === 0) {
      $cgw.prepend('<div class="pull-right control-group-buttons"><button value="upload" class="btn btn-primary">Upload</button> <button value="cancel" class="btn">Cancel</button></div>');
    }
  });

  $('#form').on('click', 'button[value="upload"]', function (e) {
    e.preventDefault();
    // ajax to save the current value
    var $this = $(this);
    $this.attr('disabled', true);
    var input = $this.closest('.control-group-wrap').find('input')[0];
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
      dataType: 'json'
    }).done(function (data, status, jqXHR) {
      var timestamp = jqXHR.getResponseHeader('Date');
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>File uploaded ' + livespan(timestamp) + '</div>');
      var $history = $this.closest('.control-group-wrap').find('.input-history');
      if ($history.length) {
        $history = $($history[0]);
      } else {
        $history = $('<div class="input-history"/>').appendTo($this.closest('.control-group-wrap').find('.controls'));
      }
      $history.html('<strong><a href=' + data.location + ' target="_blank">' + input.files[0].name + '</a></strong> uploaded by you ' + livespan(timestamp) + '; ' + $history.html());
      $.livestamp.resume();
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR, status, error) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot upload the file: ' + (jqXHR.responseText || 'unknown') + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    }).always(function () {
      $('#form input,textarea').removeAttr('disabled');
      $('#complete').removeAttr('disabled');
    });

  });

  $('#form').on('click', 'button[value="cancel"]', function (e) {
    e.preventDefault();
    // cannot reset the file input value
    $('#form input,textarea').removeAttr('disabled');
    $('#complete').removeAttr('disabled');
    $(this).closest('.control-group-buttons').remove();
  });

  $('#show-notes').click(function (e) {
    $('.input-notes').show();
  });

  $('#hide-notes').click(function (e) {
    $('.input-notes').hide();
  });

  $('#show-validation').click(function (e) {
    if ($('input:disabled').length) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('Please finish the input before validating the form.');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      return;
    }
    $('.validation').remove();
    $('#validation').html('<h3>Summary</h3>' + validation_message(document.getElementById('form')).html());
    $('#validation').show();
  });

  $('#hide-validation').click(function (e) {
    $('#validation').hide();
    $('.validation').hide();
  });

});
