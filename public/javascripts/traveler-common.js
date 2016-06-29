/*
this file include the common functions between traveler.jade and traveler-viewer.jade
*/

/*global prefix*/

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
      if (i === 0) { // show the latest picture
        output = output + '<li class="list-group-item">' +
          '<strong><a href=' + link + ' target="_blank" class="a-img">' + found[i].value + '</a><br>' +
          '<img src=' + link + ' class="img-thumbnail"><br>' +
          '</strong> uploaded by ' + found[i].inputBy + ' ' + livespan(found[i].inputOn) +
          '</li>';
      }else{
        output = output + '<li class="list-group-item">' +
          '<strong><a href=' + link + ' target="_blank" class="a-img">' + found[i].value + '</a>' +
          '<img src=' + link + ' class="img-display img-thumbnail">' +
          '</strong> uploaded by ' + found[i].inputBy + ' ' + livespan(found[i].inputOn) +
          '</li>';
      }
    }
  }
  return output;
}

// set notes pannel string
function setPanel(author, time, content, noteId, istrack) {
  var pannel = '';
  if (istrack) {
    pannel = '<div class="panel panel-info" name="' + noteId + '"><div class="panel-heading">' +
        author + ' noted ' + time +
        '<button type="button" title="Edit your note" class="btn btn-default btn-xs pull-right edit-note"><span class="glyphicon glyphicon-pencil" aria-hidden="true"></span></button>' +
        '<button type="button" title="Show changes between latest note and original note" class="btn btn-default btn-xs pull-right diff-note"><span class="glyphicon glyphicon-import" aria-hidden="true"></span></button>' +
        '<button type="button" title="Show history of all edited notes" class="btn btn-default btn-xs pull-right list-note"><span class="glyphicon glyphicon-chevron-down" aria-hidden="true"></span></button>' +
        '</div><div class="panel-body">' +
        content + '</div></div>';
  }else{
    pannel = '<div class="panel panel-info" name="' + noteId + '"><div class="panel-heading">' +
        author + ' noted ' + time +
        '<button type="button" itle="Edit your note" class="btn btn-default btn-xs pull-right edit-note"><span class="glyphicon glyphicon-pencil" aria-hidden="true"></span></button>' +
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
      output = output + setPanel(found[i].inputBy, livespan(found[i].inputOn), found[i].value, found[i]._id, found[i].preId);
    }
  }
  return output;
}

// temparary solution for the dirty forms
function cleanForm() {
  $('.control-group-buttons').remove();
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
    // $('body').attr('data-target', '.sidebar'); in traveler viewer
    $('body').attr('data-target', '#affixlist');
  }
}

function validation_message(form) {
  var i = 0, output = $('<div>');
  var p, value, input, label, span;
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
var prePanel = []; // the previous value edited

$(function () {
  createSideNav();

  cleanForm();

  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });

  // update every 30 seconds
  // $.livestamp.interval(30 * 1000);
  // update img
  $('#form').find('img').each(function (index) {
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

  // diff from current note to previous note
  $('#form').on('click', 'button.diff-note', function (e) {
    e.preventDefault();
    // archive the current panel
    var i = $(this).parents('.panel').index();
    var p = {
      value: $(this).parent().next().text(),
      head: $(this).parent().html()
    };
    prePanel[i] = p;
    var $pannelbody = $(this).parent().next();
    var $pannelhead = $(this).parent();
    var noteId = $(this).parents('.panel').attr('name');
    $.ajax({
      url: './notes_findOrigin/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        noteId: noteId
      })
    }).done(function (data) {
      var diff = JsDiff.diffChars(data.value, p.value);
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
        $pannelhead.children('button').remove();
        $pannelhead.append('<button type="button" title="show the latest note" class="btn btn-default btn-xs pull-right recover-note"><span class="glyphicon glyphicon-export" aria-hidden="true"></span></button>');
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
    // archive the current panel
    var i = $(this).parents('.panel').index();
    var p = {
      value: $(this).parent().next().text(),
      head: $(this).parent().html()
    };
    prePanel[i] = p;
    var $pannel = $(this).parents('.panel');
    var $pannelbody = $(this).parent().next();
    var $pannelhead = $(this).parent();
    var noteId = $pannel.attr('name');
    $.ajax({
      url: './notes_track/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        noteId: noteId
      })
    }).done(function (data) {
      var s = '<ul class="list-group">';
      for(var i = 0; i < data.length; i++) {
        s = s + '<li class="list-group-item">' +
          '<strong>Edit on ' + livespan(data[i].inputOn) + '</strong><br>' +
          data[i].value + '</li>';
      }
      s = s + '</ul>';
      $pannelbody.html(s);
      $pannelhead.children('button').remove();
      $pannelhead.append('<button type="button" title="show the latest note" class="btn btn-default btn-xs pull-right recover-note"><span class="glyphicon glyphicon-chevron-up" aria-hidden="true"></span></button>');

    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot find history notes: ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
  });

  $('#form').on('click', 'button.recover-note', function () {
    var i = $(this).parents('.panel').index();
    $(this).parent().next().html(prePanel[i].value);
    $(this).parent().html(prePanel[i].head);
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

  $('#show-notes').click(function () {
    $('.input-notes').show();
  });

  $('#hide-notes').click(function () {
    $('.input-notes').hide();
  });

  $('#show-validation').click(function () {
    if ($('.control-group-buttons').length) { // this is for traveler.jade
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

});