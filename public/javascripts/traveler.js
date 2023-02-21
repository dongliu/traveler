/*
global document, window, FormData, linkTarget, validationMessage, isValid,
moment, Binder, travelerStatus, finishedInput: writable, ajax401, prefix,
DiscrepancyFormLoader, traveler, markValidity, markFormValidity, findById,
livespan, Modernizr, createSideNav, generateHistoryRecordHtml
*/

/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

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
        '" download=' +
        found[i].value +
        '>' +
        found[i].value +
        '</a></strong> uploaded by ' +
        found[i].inputBy +
        ' ' +
        livespan(found[i].inputOn, false) +
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
        livespan(found[i].inputOn, false) +
        '</b>: </dt>';
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
      format: 'yyyy-mm-dd',
    });
  }
}

function setStatus(s) {
  $.ajax({
    url: './status',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      status: s,
    }),
  })
    .done(function() {
      document.location.href = window.location.pathname;
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' +
            jqXHR.responseText +
            '</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
}

function complete() {
  $('#form input,textarea').prop('disabled', true);
  setStatus(1.5);
}

/**
 * save the data in the discrepancy form into the log
 * @param {Object} the log to save data into
 */
function saveDiscrepancyLog(log) {
  var formData = new FormData($('#discrepancy-form')[0]);
  $.ajax({
    url: './logs/' + log._id + '/records',
    type: 'POST',
    data: formData,
    contentType: false,
    processData: false,
  })
    .done(function() {
      $('#message').append(
        '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Discrepancy log data saved</div>'
      );
      // reload the discrepancy log
      window.location.reload(true);
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot save discrepancy log data</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}

function incrementFinished() {
  finishedInput += 1;
  $('#finished-input').text(finishedInput);
}

function showConfirmation(action) {
  $('#modalLabel').html('Please review before action');
  $('#modal .modal-body').html(
    validationMessage(document.getElementById('form'))
  );
  $('#modal .modal-footer').html(
    '<button value="submit" class="btn btn-primary" data-dismiss="modal">Submit</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
  $('#modal button[value="submit"]').click(action);
}

function showValidation() {
  if ($('.control-group-buttons').length) {
    $('#modalLabel').html('Alert');
    $('#modal .modal-body').html(
      'Please finish the input before validating the form.'
    );
    $('#modal .modal-footer').html(
      '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modal').modal('show');
    return;
  }
  $('.validation').remove();
  $('#validation').html(
    '<h3>Summary</h3>' + validationMessage(document.getElementById('form'))
  );
  $('#validation').show();
}

function loadDiscrepancyLog(discrepancyForm) {
  DiscrepancyFormLoader.setForm(discrepancyForm);
  DiscrepancyFormLoader.renderLogs();
  DiscrepancyFormLoader.retrieveLogs();
}

$(function() {
  ajax401(prefix);

  createSideNav();

  cleanForm();

  // update every 30 seconds
  // $.livestamp.interval(30 * 1000);

  // load discrepancy table and data
  var discrepancyForm;
  if (traveler.activeDiscrepancyForm) {
    discrepancyForm = findById(
      traveler.discrepancyForms,
      traveler.activeDiscrepancyForm
    );
    DiscrepancyFormLoader.setLogTable('#discrepancy-log-table');
    DiscrepancyFormLoader.setTid(traveler._id);
    loadDiscrepancyLog(discrepancyForm);
  }

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

  $(document).bind('drop dragover', function(e) {
    e.preventDefault();
  });

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });

  dateSupport();

  var binder = new Binder.FormBinder(document.forms[0]);

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

  $('#form').on('click', 'a.new-note', function(e) {
    e.preventDefault();
    var $that = $(this);
    $('#modalLabel').html('Add new note');
    $('#modal .modal-body').html(
      '<form class="form-horizontal" id="modalform"><div class="control-group"><label class="control-label">Note: </label><div class="controls"><textarea name="note-content" rows=5></textarea><input type="hidden" name="inputname" value="' +
        $(this)
          .closest('.controls')
          .find('input, textarea')
          .prop('name') +
        '"></div></div></form>'
    );
    $('#modal .modal-footer').html(
      '<button value="submit" class="btn btn-primary" data-dismiss="modal">Submit</button><button data-dismiss="modal" aria-hidden="true" class="btn">Cancel</button>'
    );
    $('#modal').modal('show');
    $('#modal button[value="submit"]').click(function() {
      var name = $('#modal input[name="inputname"]').val();
      var value = $('#modal textarea[name="note-content"]').val();
      e.preventDefault();
      $.ajax({
        url: './notes/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          name: name,
          value: value,
        }),
      })
        .done(function(data, status, jqXHR) {
          var timestamp = jqXHR.getResponseHeader('Date');
          $('#message').append(
            '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Note saved ' +
              livespan(timestamp) +
              '</div>'
          );
          var $notes_number = $that
            .closest('.controls')
            .find('a.notes-number span.badge');
          $notes_number.text(parseInt($notes_number.text(), 10) + 1);

          // add new note
          if ($that.closest('.controls').find('.input-notes').length) {
            $that
              .closest('.controls')
              .find('.input-notes dl')
              .prepend(
                '<dt><b>You noted ' +
                  livespan(timestamp) +
                  '</b>: </dt><dd>' +
                  value +
                  '</dd>'
              );
          } else {
            $that
              .closest('.controls')
              .append(
                '<div class="input-notes"><dl><dt><b>You noted ' +
                  livespan(timestamp) +
                  '</b>: </dt><dd>' +
                  value +
                  '</dd></dl></div>'
              );
          }

          // $.livestamp.resume();
        })
        .fail(function(jqXHR) {
          if (jqXHR.status !== 401) {
            $('#message').append(
              '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot save the note: ' +
                jqXHR.responseText +
                '</div>'
            );
            $(window).scrollTop($('#message div:last-child').offset().top - 40);
          }
        });
    });
  });

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

  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      $('#form .controls').each(function(index, controlsElement) {
        var inputElements = $(controlsElement).find('input,textarea');
        var currentValue;
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
              currentValue = found[0].value;
              if (found[0].inputType === 'radio') {
                // Update element to match the value
                for (var i = 0; i < inputElements.size(); i++) {
                  var ittrInput = inputElements[i];
                  if (ittrInput.value === currentValue) {
                    element = ittrInput;
                    break;
                  }
                }
              } else if (element.type === 'number') {
                // Patch to support appropriate stepping validation for input numbers.
                element.step = 'any';
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

      // check if active here
      if (travelerStatus === 1) {
        $('#form input,textarea').prop('disabled', false);
      }

      markFormValidity(document.getElementById('form'));

      // load the notes here
      renderNotes();
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

  $('#complete').click(completeClick);
  $('#complete2').click(completeClick);

  function completeClick(e) {
    e.preventDefault();
    if (
      $('#validation').css('display') === 'none' &&
      !isValid(document.getElementById('form'))
    ) {
      showConfirmation(complete);
    } else {
      complete();
    }
  }

  // deserialize the values here
  $('#form .control-group-wrap').mouseenter(function(e) {
    e.preventDefault();
    if (!$(this).hasClass('control-focus')) {
      $(this).addClass('control-focus');
    }
  });
  $('#form .control-group-wrap').mouseleave(function(e) {
    e.preventDefault();
    if ($(this).hasClass('control-focus')) {
      $(this).removeClass('control-focus');
    }
  });

  // Safari web browser will not recognize input event for radio and checkbox.
  $('#form input[type="radio"], input[type="checkbox"]').on(
    'click',
    formInputMade
  );

  $(
    '#form input:not([type="file"]):not([type="radio"]):not([type="checkbox"]),textarea'
  ).on('input', formInputMade);

  function formInputMade() {
    var $this = $(this);
    var inputs = $this.closest('.control-group-wrap').find('input,textarea');
    var i;
    for (i = 0; i < inputs.length; i += 1) {
      markValidity(inputs[i]);
    }
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea')
      .not($(inputs))
      .prop('disabled', true);
    $('#complete').prop('disabled', true);
    if ($cgw.children('.control-group-buttons').length === 0) {
      $cgw.prepend(
        '<div class="pull-right control-group-buttons"><button value="save" class="btn btn-primary">Save</button> <button value="reset" class="btn">Reset</button></div>'
      );
    }
  }

  $('#form').on('click', 'button[value="save"]', function(e) {
    e.preventDefault();
    // ajax to save the current value
    var $this = $(this);
    var inputs = $this.closest('.control-group-wrap').find('input,textarea');
    var input = inputs[0];
    if (inputs[0].type === 'radio') {
      for (var i = 0; i < inputs.size(); i++) {
        var ittr_input = inputs[i];
        if (ittr_input.checked) {
          input = ittr_input;
          break;
        }
      }
    }

    binder.serializeField(input);

    if (
      input.type === 'number' &&
      typeof binder.accessor.target[input.name] !== 'number'
    ) {
      $('#message').append(
        '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>The input value is not a number!</div>'
      );
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
      return;
    }
    $.ajax({
      url: './data/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        name: input.name,
        type: input.type,
        value: binder.accessor.target[input.name],
      }),
    })
      .done(function(data, status, jqXHR) {
        var timestamp = jqXHR.getResponseHeader('Date');
        $('#message').append(
          '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Change saved ' +
            livespan(timestamp) +
            '</div>'
        );
        var $history = $this
          .closest('.control-group-wrap')
          .find('.input-history');
        if ($history.length > 0) {
          $history = $($history[0]);
        } else {
          incrementFinished();
          $history = $('<div class="input-history"/>').appendTo(
            $this.closest('.control-group-wrap').find('.controls')
          );
        }
        var historyRecord = generateHistoryRecordHtml(
          input.type,
          binder.accessor.target[input.name],
          'you',
          timestamp,
          true
        );
        $history.html(historyRecord + $history.html());
        // $.livestamp.resume();
        $this.closest('.control-group-buttons').remove();
      })
      .fail(function(jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the value: ' +
              jqXHR.responseText +
              '</div>'
          );
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      })
      .always(function() {
        $('#form input,textarea').prop('disabled', false);
        $('#complete').prop('disabled', false);
      });
  });

  $('#form').on('click', 'button[value="reset"]', function(e) {
    e.preventDefault();
    var $this = $(this);
    var inputs = $this.closest('.control-group-wrap').find('input,textarea');
    var i;
    for (i = 0; i < inputs.length; i += 1) {
      if (binder.accessor.target[inputs[i].name] === undefined) {
        if ($(inputs[i]).is(':checkbox') || $(inputs[i]).is(':radio')) {
          $(inputs[i]).prop('checked', false);
        } else {
          $(inputs[i]).val('');
        }
      } else {
        binder.deserializeField(inputs[i]);
      }
    }

    for (i = 0; i < inputs.length; i += 1) {
      markValidity(inputs[i]);
    }

    $('#form input,textarea').prop('disabled', false);
    $('#complete').prop('disabled', false);
    $(this)
      .closest('.control-group-buttons')
      .remove();
  });

  $('#form input:file').change(function(e) {
    e.preventDefault();
    var $this = $(this);
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea')
      .not($this)
      .prop('disabled', true);
    $('#complete').prop('disabled', true);
    var file = this.files[0];
    if (file === undefined) {
      $cgw.children('.control-group-buttons').remove();
      return;
    }

    var $validation = $cgw.find('.validation');
    if ($validation.length) {
      $validation = $($validation[0]);
    } else {
      $validation = $('<div class="validation"></div>').appendTo(
        $cgw.find('.controls')
      );
    }
    if (
      !(
        /^(image|text)\//i.test(file.type) ||
        file.type === 'application/pdf' ||
        file.type === 'application/vnd.ms-excel' ||
        file.type ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-xpsdocument' ||
        file.type === 'application/oxps'
      )
    ) {
      $validation.html(
        '<p class="text-error">' + file.type + ' is not allowed to upload</p>'
      );
      $cgw.children('.control-group-buttons').remove();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      $validation.html(
        '<p class="text-error">' + file.size + ' is too large to upload</p>'
      );
      $cgw.children('.control-group-buttons').remove();
      return;
    }
    // clear validation message if any
    $validation.empty();

    if ($cgw.children('.control-group-buttons').length === 0) {
      $cgw.prepend(
        '<div class="pull-right control-group-buttons"><button value="upload" class="btn btn-primary">Upload</button> <button value="cancel" class="btn">Cancel</button></div>'
      );
    }
  });

  $('#form').on('click', 'button[value="upload"]', function(e) {
    e.preventDefault();
    // ajax to save the current value
    var $this = $(this);
    $this.prop('disabled', true);
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
      dataType: 'json',
    })
      .done(function(json, status, jqXHR) {
        var timestamp = jqXHR.getResponseHeader('Date');
        $('#message').append(
          '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>File uploaded ' +
            livespan(timestamp) +
            '</div>'
        );
        var $history = $this
          .closest('.control-group-wrap')
          .find('.input-history');
        if ($history.length > 0) {
          $history = $($history[0]);
        } else {
          // add an input-history div
          incrementFinished();
          $history = $('<div class="input-history"/>').appendTo(
            $this.closest('.control-group-wrap').find('.controls')
          );
        }
        $history.html(
          '<strong><a href=' +
            json.location +
            ' target="' +
            linkTarget +
            '">' +
            input.files[0].name +
            '</a></strong> uploaded by you ' +
            livespan(timestamp) +
            '; ' +
            $history.html()
        );
        // $.livestamp.resume();
        $this.closest('.control-group-buttons').remove();
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
      .always(function() {
        $('#form input,textarea').prop('disabled', false);
        $('#complete').prop('disabled', false);
      });
  });

  $('#form').on('click', 'button[value="cancel"]', function(e) {
    e.preventDefault();
    // cannot reset the file input value
    $('#form input,textarea').prop('disabled', false);
    $('#complete').prop('disabled', false);
    $(this)
      .closest('.control-group-buttons')
      .remove();
  });

  $('#work').click(function(e) {
    e.preventDefault();
    setStatus(1);
  });

  $('#freeze').click(function(e) {
    e.preventDefault();
    setStatus(3);
  });

  $('#resume').click(function(e) {
    e.preventDefault();
    setStatus(1);
  });

  $('#approve').click(function(e) {
    e.preventDefault();
    setStatus(2);
  });

  $('#more').click(function(e) {
    e.preventDefault();
    setStatus(1);
  });

  $('#show-notes').click(function() {
    $('.input-notes').show();
  });

  $('#hide-notes').click(function() {
    $('.input-notes').hide();
  });

  $('#show-validation').click(showValidation);

  $('#hide-validation').click(function() {
    $('#validation').hide();
    $('.validation').hide();
  });

  $('#add-discrepancy').click(function() {
    $.ajax({
      url: './logs/',
      type: 'POST',
      contentType: 'application/json',
      dataType: 'json',
      data: JSON.stringify({
        form: traveler.referenceDiscrepancyForm,
      }),
    })
      .done(function(log) {
        $('#modalLabel').html('Please input discrepancy log details');
        $('#modal .modal-body').html(
          '<form id="discrepancy-form" class="form-horizontal">' +
            discrepancyForm.html +
            '</form>'
        );
        $('#modal .modal-footer').html(
          '<button value="submit" class="btn btn-primary">Submit</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
        );
        $('#modal').modal('show');
        if (travelerStatus === 1 || travelerStatus === 1.5) {
          $('#discrepancy-form input,textarea').prop('disabled', false);
        }
        $('#modal button[value="submit"]').click(function() {
          // validate and then save it
          var logForm = document.getElementById('discrepancy-form');
          if (!validateLog(logForm)) {
            $('#modalLabel').html('Discrepancy log data is invalid');
            return;
          }
          saveDiscrepancyLog(log);
        });
      })
      .fail(function(jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot create discrepancy log</div>'
          );
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      })
      .always();
  });
});
