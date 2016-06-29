/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global travelerStatus: true, finishedInput: true, ajax401: false, prefix */
/*global prePanel:true, livespan, renderNotes, setPanel, fileHistory */

/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

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
  }).done(function () {
    document.location.href = window.location.pathname;
  }).fail(function (jqXHR) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });
}

function updateFinished(num) {
  finishedInput = num;
  $('#finished-input').text(num);
  $.ajax({
    url: './finishedinput',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      finishedInput: num
    })
  }).fail(function (jqXHR) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot update finished input number</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();
}

$(function () {

  ajax401(prefix);

  $(document).bind('drop dragover', function (e) {
    e.preventDefault();
  });

  dateSupport();

  $('#form').on('click', 'a.new-note', function (e) {
    e.preventDefault();
    var $that = $(this);
    $('#modalLabel').html('Add new note');
    $('#modal .modal-body').html('<form class="form-horizontal" id="modalform"><div class="form-group"><label class="col-sm-4 control-label">Note: </label><div class="col-sm-6"><textarea name="note-content" rows=5></textarea><input type="hidden" name="inputname" value="' + $(this).closest('.col-xs-offset-2').find('input, textarea').prop('name') + '"></div></div></form>');
    $('#modal .modal-footer').html('<button value="submit" class="btn btn-primary" data-dismiss="modal">Submit</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>');
    $('#modal').modal('show');
    $('#modal button[value="submit"]').click(function () {
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
        var $notes_number = $that.closest('.col-xs-offset-2').find('a.notes-number span.badge');
        $notes_number.text(parseInt($notes_number.text(), 10) + 1);

        // add new note
        if ($that.closest('.col-xs-offset-2').find('.input-notes').length) {
          $that.closest('.col-xs-offset-2').find('.input-notes').prepend(setPanel('You', livespan(timestamp), value, data));
        } else {
          $that.closest('.col-xs-offset-2').append('<div class="input-notes">' +
              setPanel('You', livespan(timestamp), value, data) +
              '</div>');
        }
        // refresh prePanel
        prePanel.unshift('');
      }).fail(function (jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot save the note: ' + jqXHR.responseText + '</div>');
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      });
    });
  });

  /*edit and update note */
  $('#form').on('click', 'button.edit-note', function (e) {
    e.preventDefault();
    var i = $(this).parents('.panel').index();
    var p = {
      value: $(this).parent().next().text(),
      head: $(this).parent().html()
    };
    prePanel[i] = p;
    $(this).parent().next().html('<textarea name="note-content" style="width:100%">' + p.value + '</textarea>' +
          '<div><button type="button" class="btn btn-primary pull-right update-note">Update</button>' +
          '<button type="button" class="btn btn-warning pull-right cacell-edit">Cacell</button><div>');
    $(this).parent().children('button').remove();
  });

  $('#form').on('click', 'button.cacell-edit', function (e) {
    e.preventDefault();
    var i = $(this).parents('.panel').index();
    $(this).parents('.panel-body').prev().html(prePanel[i].head);
    $(this).parents('.panel-body').html(prePanel[i].value);
  });

  $('#form').on('click', 'button.update-note', function (e) {
    e.preventDefault();
    var $that = $(this);
    var value = $(this).parent().prev().val();
    var i = $(this).parents('.panel').index();
    if(value === prePanel[i].value) {
      $that.parents('.panel-body').html(value);
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Nothing changed on note </div>');
      return;
    }
    var noteId = $(this).parents('.panel').attr('name');
    $.ajax({
      url: './notes_update/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        name: '',
        value: {
          value: value,
          noteId: noteId
        }
      })
    }).done(function (data, status, jqXHR) {
      //update id
      $that.parents('.panel').attr('name', data);
      //append button{
      $that.parents('.panel').find('.panel-heading').append('<button type="button" title="Edit your note" class="btn btn-default btn-xs pull-right edit-note"><span class="glyphicon glyphicon-pencil" aria-hidden="true"></span></button>');
      $that.parents('.panel').find('.panel-heading').append('<button type="button" class="btn btn-default btn-xs pull-right diff-note"><span class="glyphicon glyphicon-import" aria-hidden="true"></span></button>');
      $that.parents('.panel').find('.panel-heading').append('<button type="button" class="btn btn-default btn-xs pull-right list-note"><span class="glyphicon glyphicon-chevron-down" aria-hidden="true"></span></button>');
      // refresh note
      $that.parents('.panel-body').html(value);
      // load infomation
      var timestamp = jqXHR.getResponseHeader('Date');
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Note updated ' + livespan(timestamp) + '</div>');
    }).fail(function (jqXHR) {
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot update the note: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    });
  });

  var realFinishedInput = 0;
  var binder = new Binder.FormBinder(document.forms[0]);

  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json'
  }).done(function (data) {
    $('#form input,textarea').each(function (index, element) {
      var found = data.filter(function (e) {
        return e.name === element.name;
      });
      if (found.length) {
        realFinishedInput += 1;
        found.sort(function (a, b) {
          if (a.inputOn > b.inputOn) {
            return -1;
          }
          return 1;
        });
        if (this.type === 'file') {
          $(element).closest('.col-xs-offset-2').append('<b>history:</b><div class="input-history list-group">' + fileHistory(found) + '</div>');
        } else {
          binder.deserializeFieldFromValue(element, found[0].value);
          binder.accessor.set(element.name, found[0].value);
          $(element).closest('.col-xs-offset-2').append('<b>history:</b><div class="input-history list-group">' + history(found) + '</div>');
        }
      }
    });

    // check if active here
    if (travelerStatus === 1) {
      $('#form input,textarea').removeAttr('disabled');
    }

    // update finished input number
    if (realFinishedInput !== finishedInput) {
      updateFinished(realFinishedInput);
    }

    // load the notes here
    renderNotes();

  }).fail(function (jqXHR) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
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

  $('#form input:not([type="file"], [type="checkbox"]),textarea').on('input', function () {
    var $this = $(this);
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea').not($this).attr('disabled', true);
    $('#completed').attr('disabled', true);
    if ($cgw.children('.control-group-buttons').length === 0) {
      $cgw.prepend('<div class="pull-right control-group-buttons"><button value="save" class="btn btn-primary">Save</button> <button value="reset" class="btn">Reset</button></div>');
    }
  });

  $('#form input:not([type="file"])').change(function () {
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
      if ($history.length > 0) {
        $history = $($history[0]);
      } else {
        // add an input-history div
        realFinishedInput += 1;
        if (finishedInput !== realFinishedInput) {
          updateFinished(realFinishedInput);
        }
        $history = $('<div class="input-history"/>').appendTo($this.closest('.control-group-wrap').find('.col-xs-offset-2'));
      }
      $history.html('changed to <strong>' + binder.accessor.target[input.name] + '</strong> by you ' + livespan(timestamp) + '; ' + $history.html());
      // $.livestamp.resume();
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot change the value: ' + jqXHR.responseText + '</div>');
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
      $validation = $('<div class="validation"></div>').appendTo($cgw.find('.col-xs-offset-2'));
    }
    if (!(/^(image|text)\//i.test(file.type) || file.type === 'application/pdf' || file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-xpsdocument' || file.type === 'application/oxps')) {
      $validation.html('<p class="text-danger">' + file.type + ' is not allowed to upload</p>');
      $cgw.children('.control-group-buttons').remove();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      $validation.html('<p class="text-danger">' + file.size + ' is too large to upload</p>');
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
    }).done(function (json, status, jqXHR) {
      var timestamp = jqXHR.getResponseHeader('Date');
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>File uploaded ' + livespan(timestamp) + '</div>');
      var $history = $this.closest('.control-group-wrap').find('.input-history');
      if ($history.length > 0) {
        $history = $($history[0]);
      } else {
        // add an input-history div
        realFinishedInput += 1;
        if (finishedInput !== realFinishedInput) {
          updateFinished(realFinishedInput);
        }
        $history = $('<div class="input-history"/>').appendTo($this.closest('.control-group-wrap').find('.col-xs-offset-2'));
      }
      $history.html('<li class="list-group-item"><strong><a href=' + json.location + ' target="_blank" class="a-img">' + input.files[0].name + '</a>' +
          '<img src=' + json.location + ' class="img-display img-thumbnail">' +
          '</strong> uploaded by you ' + livespan(timestamp) + '</li>' + $history.html());
      // $.livestamp.resume();
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot upload the file: ' + (jqXHR.responseText || 'unknown') + '</div>');
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

  $('#work').click(function (e) {
    e.preventDefault();
    setStatus(1);
  });

  $('#freeze').click(function (e) {
    e.preventDefault();
    setStatus(3);
  });

  $('#resume').click(function (e) {
    e.preventDefault();
    setStatus(1);
  });

  $('#approve').click(function (e) {
    e.preventDefault();
    setStatus(2);
  });

  $('#more').click(function (e) {
    e.preventDefault();
    setStatus(1);
  });

  $('#update-progress').click(function () {
    if (realFinishedInput !== finishedInput) {
      updateFinished(realFinishedInput);
    }
  });

});
