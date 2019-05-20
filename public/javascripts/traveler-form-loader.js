/*global moment: false, prefix: false, Binder: false*/

var FormLoader = (function(parent, $) {
  var data = null;
  var notes = null;
  var formHTML = null;
  var tid = null;

  // temparary solution for the dirty forms
  function cleanForm() {
    $('.control-group-buttons').remove();
  }

  /**
   * generates the html history snippet for an input.
   * @param  {[TravelerData]} found The traveler data array for a specific input.
   * @return {String} html snippet
   */
  function history(found) {
    var i;
    var output = '';
    if (found.length > 0) {
      for (i = 0; i < found.length; i += 1) {
        output =
          output +
          'changed to <strong>' +
          found[i].value +
          '</strong> by ' +
          found[i].inputBy +
          ' ' +
          moment(found[i].inputOn).fromNow() +
          '; ';
      }
    }
    return output;
  }

  /**
   * generates the html history snippet for a file input.
   * @param  {[TravelerData]} found The traveler data array for a specific file input.
   * @return {String} html snippet
   */
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
          moment(found[i].inputOn).fromNow() +
          '; ';
      }
    }
    return output;
  }

  /**
   * @param  {Element} form The form DOM element to be validated.
   * @return {String} The validation result.
   */
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
      label = $(input)
        .closest('.control-group')
        .children('.control-label')
        .text();
      if (label === '' && input.type === 'checkbox') {
        label = $(input)
          .next()
          .text();
      }
      if (input.checkValidity()) {
        p.html('<b>' + label + '</b>: ' + value);
        span.text('validation passed');
      } else {
        p.html(
          '<b>' +
            label +
            '</b>: ' +
            value +
            ' | Message: ' +
            input.validationMessage
        );
        span.text(input.validationMessage);
      }
      $(input)
        .closest('.controls')
        .append(span);
      output.append(p);
    }
    return output;
  }

  /**
   * Generates the note html snippet.
   * @param  {[TravelerNote]} found An array of traveler notes for a specific input.
   * @return {String} The html note snippet.
   */
  function generateNotes(found) {
    var i;
    var output = '<dl>';
    if (found.length > 0) {
      for (i = 0; i < found.length; i += 1) {
        output =
          output +
          '<dt><b>' +
          found[i].inputBy +
          ' noted ' +
          moment(found[i].inputOn).fromNow() +
          '</b>: </dt>';
        output = output + '<dd>' + found[i].value + '</dd>';
      }
    }
    return output + '</dl>';
  }

  /**
   * @return {undefined}
   */
  function renderNotes() {
    $('#form .controls').each(function(index, controlsElement) {
      var inputElements = $(controlsElement).find('input,textarea');
      if (inputElements.length) {
        var element = inputElements[0];
        var found = notes.filter(function(e) {
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
                generateNotes(found) +
                '</div>'
            );
        }
      }
    });
  }

  function renderImg() {
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
  }

  function viewerEvents() {
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
        '<h3>Summary</h3>' +
          validation_message(document.getElementById('form')).html()
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
  }

  function renderForm() {
    createSideNav();
    cleanForm();
    renderImg();
  }

  /**
   * @param  {FormBinder} binder The form binder.
   * @return {undefined}
   */
  function bindData(binder) {
    $('#form input,textarea').each(function(index, element) {
      var found = data.filter(function(d) {
        return d.name === element.name;
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
              '<div class="input-history">' + fileHistory(found) + '</div>'
            );
        } else {
          binder.deserializeFieldFromValue(element, found[0].value);
          binder.accessor.set(element.name, found[0].value);
          // history only once for radio
          if (element.type === 'radio') {
            if (element.value !== found[0].value) {
              return false;
            }
          }
          $(element)
            .closest('.controls')
            .append('<div class="input-history">' + history(found) + '</div>');
        }
      }
    });
  }

  function retrieveData(cb) {
    $.ajax({
      url: '/travelers/' + tid + '/data/',
      type: 'GET',
      dataType: 'json',
    }).done(function(json) {
      data = json;
      cb();
    });
  }

  function retrieveNotes(cb) {
    $.ajax({
      url: '/travelers/' + tid + '/notes/',
      type: 'GET',
      dataType: 'json',
    }).done(function(json) {
      notes = json;
      cb();
    });
  }

  /**
   * @param  {String} fid The form id to retrieve.
   * @return {undefined}
   */
  function retrieveForm(fid, cb) {
    $.ajax({
      url: '/forms/' + fid + '/json',
      type: 'GET',
      dataType: 'json',
      success: function(json) {
        cb(json);
      },
    });
  }

  /**
   * Loads the form html, bind the data and notes.
   * @return {undefined}
   */
  function loadForm() {
    $('#form').html(formHTML);
    renderForm();
    viewerEvents();
  }

  function bind() {
    if (data !== null) {
      var binder = new Binder.FormBinder(document.forms[0]);
      bindData(binder, data);
    } else {
      retrieveData(bind);
    }
  }

  function note() {
    if (notes !== null) {
      renderNotes(notes);
    } else {
      retrieveNotes(note);
    }
  }

  function setTravelerId(id) {
    tid = id;
  }

  function setFormHTML(html) {
    formHTML = html;
  }

  parent.retrieveForm = retrieveForm;
  parent.setFormHTML = setFormHTML;
  parent.setTravelerId = setTravelerId;
  parent.loadForm = loadForm;
  parent.bind = bind;
  parent.note = note;

  return parent;
})(FormLoader || {}, jQuery);
