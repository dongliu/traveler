/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, prefix: false*/

// temparary solution for the dirty forms
function cleanForm() {
  $('.control-group-buttons').remove();
}

function fileHistory(found) {
  var i;
  var output = '';
  var link;
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      link = prefix + '/data/' + found[i]._id;
      output =
        output +
        '<strong><a href=' +
        link +
        ' target="' +
        linkTarget +
        '">' +
        found[i].value +
        '</a></strong> uploaded by ' +
        found[i].inputBy +
        ' ' +
        livespan(found[i].inputOn) +
        '; ';
    }
  }
  return output;
}

function notes(found) {
  var i;
  var output = '<dl>';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output =
        output +
        '<dt><b>' +
        found[i].inputBy +
        ' noted ' +
        livespan(found[i].inputOn) +
        '</b>: </dt>';
      output = output + '<dd>' + found[i].value + '</dd>';
    }
  }
  return output + '</dl>';
}

function renderNotes() {
  $.ajax({
    url: './notes/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      $('#form .controls').each(function(index, controlsElement) {
        var inputElements = $(controlsElement).find('input,textarea');
        if (inputElements.length) {
          var element = inputElements[0];
          var found = data.filter(function(e) {
            return e.name === element.name;
          });
          $(element)
            .closest('.controls')
            .append(
              '<div class="note-buttons"><b>notes</b>: <a class="notes-number" href="#" data-toggle="tooltip" title="show/hide notes"><span class="badge badge-info">' +
                found.length +
                '</span></a> <a class="new-note" href="#" data-toggle="tooltip" title="new note"><i class="fa fa-file-o fa-lg"></i></a></div>'
            );
          if (found.length) {
            found.sort(function(a, b) {
              if (a.inputOn > b.inputOn) {
                return -1;
              }
              return 1;
            });
            $(element)
              .closest('.controls')
              .append(
                '<div class="input-notes" style="display: none;">' +
                  notes(found) +
                  '</div>'
              );
          }
        }
      });
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}

$(function() {
  createSideNav();
  cleanForm();

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });

  // update img
  $('#form')
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

  var binder = new Binder.FormBinder(document.forms[0]);
  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      $('#form .controls').each(function(index, controlsElement) {
        var inputElements = $(controlsElement).find('input,textarea');
        if (inputElements.length) {
          var element = inputElements[0];
          var found = data.filter(function(e) {
            return e.name === element.name;
          });
          if (found.length) {
            found.sort(function(a, b) {
              if (a.inputOn > b.inputOn) {
                return -1;
              }
              return 1;
            });
            if (element.type === 'file') {
              $(element)
                .closest('.controls')
                .append(
                  '<div class="input-history"><b>history</b>: ' +
                    fileHistory(found) +
                    '</div>'
                );
            } else {
              var currentValue = found[0].value;
              if (found[0].inputType === 'radio') {
                // Update element to match the value
                for (var i = 0; i < inputElements.size(); i++) {
                  var ittrInput = inputElements[i];
                  if (ittrInput.value === currentValue) {
                    element = ittrInput;
                    break;
                  }
                }
              }
              binder.deserializeFieldFromValue(element, currentValue);
              binder.accessor.set(element.name, currentValue);
              $(element)
                .closest('.controls')
                .append(
                  '<div class="input-history"><b>history</b>: ' +
                    history(found) +
                    '</div>'
                );
            }
          }
        }
      });

      markFormValidity(document.getElementById('form'));

      // load the notes here
      renderNotes();
    })
    .fail(function() {
      $('#message').append(
        '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>'
      );
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    })
    .always();

  $('#form').on('click', 'a.notes-number', function(e) {
    e.preventDefault();
    var $input_notes = $(this)
      .closest('.controls')
      .find('.input-notes');
    if ($input_notes.is(':visible')) {
      $input_notes.hide();
    } else {
      $input_notes.show();
    }
  });

  $('#show-validation').click(function() {
    $('.validation').remove();
    $('#validation').html(
      '<h3>Summary</h3>' + validationMessage(document.getElementById('form'))
    );
    $('#validation').show();
  });

  $('#hide-validation').click(function() {
    $('#validation').hide();
    $('.validation').hide();
  });

  $('#show-notes').click(function() {
    $('.input-notes').show();
  });

  $('#hide-notes').click(function() {
    $('.input-notes').hide();
  });
});
