/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, Modernizr: false, prefix: false*/

// temparary solution for the dirty forms
function cleanForm() {
  $('.control-group-buttons').remove();
}

function livespan(stamp, live) {
  if (live) {
    return '<span data-livestamp="' + stamp + '"></span>';
  } else {
    return '<span>' + moment(stamp).format('dddd, MMMM Do YYYY, h:mm:ss a') + '</span>';
  }
}

function history(found) {
  var i, output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = output + 'changed to <strong>' + found[i].value + '</strong> by ' + found[i].inputBy + ' ' + livespan(found[i].inputOn) + '; ';
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
      link = prefix + '/data/' + found[i]._id;
      output = output + '<strong><a href=' + link + ' target="_blank">' + found[i].value + '</a></strong> uploaded by ' + found[i].inputBy + ' ' + livespan(found[i].inputOn) + '; ';
    }
  }
  return output;
}

function notes(found) {
  var i, output = '<dl>';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = output + '<dt><b>' + found[i].inputBy + ' noted ' + livespan(found[i].inputOn) + '</b>: </dt>';
      output = output + '<dd>' + found[i].value + '</dd>';
    }
  }
  return output + '</dl>';
}

function createSideNav() {
  var $legend = $('legend');
  var $affix = $('<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>');
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

function validation_message(form) {
  var i = 0,
    output = $('<div>');
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
    $(input).closest('.controls').append(span);
    output.append(p);
  }
  return output;
}


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
      $(element).closest('.controls').append('<div class="note-buttons"><b>notes</b>: <a class="notes-number" href="#" data-toggle="tooltip" title="show/hide notes"><span class="badge badge-info">' + found.length + '</span></a></div>');
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

$(function () {
  createSideNav();
  cleanForm();

  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });

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

  var binder = new Binder.FormBinder(document.forms[0]);
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
          $(element).closest('.controls').append('<div class="input-history">' + fileHistory(found) + '</div>');
        } else {
          binder.deserializeFieldFromValue(element, found[0].value);
          binder.accessor.set(element.name, found[0].value);
          $(element).closest('.controls').append('<div class="input-history">' + history(found) + '</div>');
        }
      }
    });

    // load the notes here
    renderNotes();
  }).fail(function (jqXHR, status, error) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();

  $('#form').on('click', 'a.notes-number', function (e) {
    e.preventDefault();
    var $input_notes = $(this).closest('.controls').find('.input-notes');
    if ($input_notes.is(':visible')) {
      $input_notes.hide();
    } else {
      $input_notes.show();
    }
  });

  $('#show-validation').click(function (e) {
    $('.validation').remove();
    $('#validation').html('<h3>Summary</h3>' + validation_message(document.getElementById('form')).html());
    $('#validation').show();
  });

  $('#hide-validation').click(function (e) {
    $('#validation').hide();
    $('.validation').hide();
  });

  $('#show-notes').click(function (e) {
    $('.input-notes').show();
  });

  $('#hide-notes').click(function (e) {
    $('.input-notes').hide();
  });

});
