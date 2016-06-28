/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, Modernizr: false*/
/*global travelerStatus: true, finishedInput: true, ajax401: false, prefix*/

/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/
function livespan(stamp, live) {
  if (live) {
    return '<span data-livestamp="' + stamp + '"></span>';
  } else {
    return '<span>' + moment(stamp).format('dddd, MMMM Do YYYY, h:mm:ss a') + '</span>';
  }
}

function history(found) {
  var i;
  var output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = output + '<li class="list-group-item">changed to <strong>' + found[i].value + '</strong> by ' + found[i].inputBy + ' ' + livespan(found[i].inputOn) + '</li>';
    }
  }
  return output;
}

function fileHistory(found) {
  var i;
  var output = '';
  var link;
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      link = prefix + '/data/' + found[i]._id;
      output = output + '<li class="list-group-item">' +
          '<strong><a href=' + link + ' target="_blank" class="a-img">' + found[i].value + '</a>' +
          '<img src=' + link + ' class="img-display img-thumbnail">' +
          '</strong> uploaded by ' + found[i].inputBy + ' ' + livespan(found[i].inputOn) +
          '</li>';
    }
  }
  return output;
}

// set notes pannel string
function setPannel(author, time, content, noteId, istrack) {
  var pannel = '';
  if (istrack) {
    pannel = '<div class="panel panel-info" name="' + noteId + '"><div class="panel-heading">' +
        author + ' noted ' + time +
        '<button type="button" class="btn btn-default btn-xs pull-right edit-note"><span class="glyphicon glyphicon-pencil" aria-hidden="true"></span></button>' +
        '<button type="button" class="btn btn-default btn-xs pull-right diff-note"><span class="glyphicon glyphicon-time" aria-hidden="true"></span></button>' +
        '<button type="button" class="btn btn-default btn-xs pull-right list-note"><span class="glyphicon glyphicon-chevron-down" aria-hidden="true"></span></button>' +
        '</div><div class="panel-body">' +
        content + '</div></div>';
  }else{
    pannel = '<div class="panel panel-info" name="' + noteId + '"><div class="panel-heading">' +
        author + ' noted ' + time +
        '<button type="button" class="btn btn-default btn-xs pull-right edit-note"><span class="glyphicon glyphicon-pencil" aria-hidden="true"></span></button>' +
        '</div><div class="panel-body">' +
        content + '</div></div>';
  }
  return pannel;
}

function notes(found) {
  var i;
  var output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = output + setPannel(found[i].inputBy, livespan(found[i].inputOn), found[i].value, found[i]._id, found[i].preId);
    }
  }
  return output;
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
  }).done(function () {
    document.location.href = window.location.pathname;
  }).fail(function (jqXHR) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });
}

function createSideNav() {
  var $legend = $('legend');
  var $affix = $('<ul class="nav nav-pills nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>');
  var i;
  if ($legend.length > 1) {
    for (i = 0; i < $legend.length; i += 1) {
      $affix.append('<li><a href="#' + $legend[i].id + '">' + $legend[i].textContent + '</a></li>');
    }
    $('.sidebar').append($('<div id="affixlist"></div>').append($affix));
    $('body').attr('data-spy', 'scroll');
    $('body').attr('data-target', '#affixlist');
  }
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

function validation_message(form) {
  var i = 0;
  var output = $('<div>');
  var p;
  var value;
  var input;
  var label;
  var span;
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
    } else if (input.value === '') {
      value = 'no input from user';
    } else {
      value = input.value;
    }
    label = $(input).closest('.control-group').children('.control-label').text();
    if (label === '' && input.type === 'checkbox') {
      label = $(input).next().text();
    }
    if (input.checkValidity()) {
      p.html('<b>' + label + '</b>: ' + value);
      span.text('validation passed');
    } else {
      p.html('<b>' + label + '</b>: ' + value + ' | Message: ' + input.validationMessage);
      span.text(input.validationMessage);
    }
    $(input).closest('.col-xs-offset-2').append(span);
    output.append(p);
  }
  return output;
}

$(function () {

  ajax401(prefix);

  createSideNav();

  cleanForm();

  // update every 30 seconds
  // $.livestamp.interval(30 * 1000);

  // update img
  $('#form').find('img').each(function () {
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
    }).done(function (data) {
      $('#form input,textarea').each(function (index, element) {
        var found = data.filter(function (e) {
          return e.name === element.name;
        });
        found = found.filter(function (e) {
          return e.isPre === undefined || e.isPre === false;
        });
        $(element).closest('.col-xs-offset-2').append('<div class="note-buttons"><b>notes</b>: <a class="notes-number" href="#" data-toggle="tooltip" title="show/hide notes"><span class="badge badge-info">' + found.length + '</span></a> <a class="new-note" href="#" data-toggle="tooltip" title="new note"><i class="fa fa-file-o fa-lg"></i></a></div>');
        if (found.length) {
          found.sort(function (a, b) {
            if (a.inputOn > b.inputOn) {
              return -1;
            }
            return 1;
          });
          $(element).closest('.col-xs-offset-2').append('<div class="input-notes" style="display: none;">' + notes(found) + '</div>');
        }
      });
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    }).always();
  }

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
          $that.closest('.col-xs-offset-2').find('.input-notes').prepend(setPannel('You', livespan(timestamp), value, data));
        } else {
          $that.closest('.col-xs-offset-2').append('<div class="input-notes">' +
              setPannel('You', livespan(timestamp), value, data) +
              '</div>');
        }

        // $.livestamp.resume();
      }).fail(function (jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot save the note: ' + jqXHR.responseText + '</div>');
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      });
    });
  });

  /*edit and update note */
  var preValue; // the previous value edited
  $('#form').on('click', 'button.edit-note', function (e) {
    e.preventDefault();
    // in history status
    if ($(this).parent().next().find('.list-group').length > 0) {return;}
    // in edit status
    if ($(this).parent().next('.cacell-edit').length > 0) {
      return;
    }else {
      // cacell previous edited pannel
      if ($('textarea[name="note-content"]')) {
        $('textarea[name="note-content"]').parent().html(preValue);
      }
      preValue = $(this).parent().next().text();
      $(this).parent().next().html('<textarea name="note-content" style="width:100%">' + preValue + '</textarea>' +
          '<div><button type="button" class="btn btn-primary pull-right update-note">Update</button>' +
          '<button type="button" class="btn btn-warning pull-right cacell-edit">Cacell</button><div>');
    }
  });

  $('#form').on('click', 'button.cacell-edit', function (e) {
    e.preventDefault();
    $(this).parent().parent().html(preValue);
  });

  $('#form').on('click', 'button.update-note', function (e) {
    e.preventDefault();
    var $that = $(this);
    var value = $(this).parent().prev().val();
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
    }).done(function (data) {
      //update id
      $that.parents('.panel').attr('name', data);
      //append button
      if($that.parents('.panel').find('.diff-note').length === 0) {
        $that.parents('.panel').find('.panel-heading').append('<button type="button" class="btn btn-default btn-xs pull-right diff-note"><span class="glyphicon glyphicon-time" aria-hidden="true"></span></button>');
      }
      // refresh note
      $that.parents('.panel-body').html(value);
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot update the note: ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
  });

  // diff from current note to previous note
  $('#form').on('click', 'button.diff-note', function (e) {
    e.preventDefault();
    var $pannel = $(this).parents('.panel');
    var $pannelbody = $(this).parent().next();
    var curValue = $pannelbody.text();
    var noteId = $pannel.attr('name');
    if ($pannelbody.find('textarea').length !== 0) {// in edit status
      return;
    }
    if($pannelbody.find('span').length !== 0) {// has been in diff status
      var s = $pannelbody.html();
      s = s.replace(/<span class="str-remove">(.*?)<\/span>/g, '');
      s = s.replace(/<span.*?>/, '');
      s = s.replace(/<\/span>/, '');
      $pannelbody.html(s);
      return;
    }
    $.ajax({
      url: './notes_findOrigin/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        noteId: noteId
      })
    }).done(function (data) {
      var diff = JsDiff.diffChars(data.value, curValue);
      var diffstr = '';
      diff.forEach(function (part) {
        // green for additions, red for deletions, grey for common parts
        if(part.removed) {
          diffstr = diffstr + '<span class="str-remove">' + part.value + '</span>';
        }else if(part.added) {
          diffstr = diffstr + '<span class="str-add">' + part.value + '</span>';
        }else {
          diffstr = diffstr + part.value;
        }
        $pannelbody.html(diffstr);
      });
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot find current note: ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
  });

// list edited note history
  $('#form').on('click', 'button.list-note', function (e) {
    e.preventDefault();
    var $that = $(this);
    var $pannel = $(this).parents('.panel');
    var $pannelbody = $(this).parent().next();
    var noteId = $pannel.attr('name');
    if ($pannelbody.find('textarea').length > 0) {// in edit status
      return;
    }
    if($pannelbody.find('.list-group').length > 0){ // in history status
      var s = $pannelbody.find('.list-group-item').first().html();
      s = s.replace(/<strong>(.*?)<\/strong>/g, '');
      $pannelbody.html(s);
      return;
    }
    if($pannelbody.find('span').length > 0) {// in diff status
      return;
    }
    $.ajax({
      url: './notes_track/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        noteId: noteId
      })
    }).done(function (data) {
      var s = '<ul class="list-group">';
      for(var i = 0; i < data.length; i++){
        s = s + '<li class="list-group-item">' +
            '<strong>Edit on' + livespan(data[i].inputOn) + '</strong><br>' +
            data[i].value + '</li>';
      }
      s = s + '</ul>';
      $pannelbody.html(s);
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot find history notes: ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
  });


  $('#form').on('click', 'a.notes-number', function (e) {
    e.preventDefault();
    var $input_notes = $(this).closest('.col-xs-offset-2').find('.input-notes');
    if ($input_notes.is(':visible')) {
      $input_notes.hide();
    } else {
      $input_notes.show();
    }
  });

  var realFinishedInput = 0;

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

  $('#show-notes').click(function () {
    $('.input-notes').show();
  });

  $('#hide-notes').click(function () {
    $('.input-notes').hide();
  });

  $('#show-validation').click(function () {
    if ($('.control-group-buttons').length) {
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

  $('#hide-validation').click(function () {
    $('#validation').hide();
    $('.validation').hide();
  });

  $('#update-progress').click(function () {
    if (realFinishedInput !== finishedInput) {
      updateFinished(realFinishedInput);
    }
  });

});
