/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false*/
/*global travelerStatus: false*/
$(function () {
  $(document).bind('drop dragover', function (e) {
    e.preventDefault();
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
        binder.deserializeFieldFromValue(element, found[0].value);
        binder.accessor.set(element.name, found[0].value);
        $(element).closest('.controls').append('<div class="history">' + history(found) + '</div>');
      }
    });
    // check if active here
    if (travelerStatus === 1) {
      $('#form input,textarea').removeAttr('disabled');
    }
  }).fail(function (jqXHR, status, error) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();



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

  $('#form input:not([type="file"]),textarea').change(function (e) {
    var $this = $(this);
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea').not($this).attr('disabled', true);
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
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Change saved ' + moment(timestamp).fromNow() + '</div>');
      var $history = $this.closest('.control-group-wrap').find('.history');
      if ($history.length) {
        $history = $($history[0]);
      } else {
        $history = $('<div class="history"/>').appendTo($this.closest('.control-group-wrap').find('.controls'));
      }
      $history.html('changed to <strong>' + binder.accessor.target[input.name] + '</strong> by me ' + moment(timestamp).fromNow() + '; ' + $history.html());
      $('#form input,textarea').removeAttr('disabled');
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR, status, error) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the value: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }).always();

  });


  $('#form').on('click', 'button[value="reset"]', function (e) {
    e.preventDefault();
    var $this = $(this);
    var input = $this.closest('.control-group-wrap').find('input,textarea')[0];
    if (binder.accessor.target[input.name] === undefined) {
      $(input).val('');
    } else {
      binder.deserializeField(input);
    }
    $('#form input,textarea').removeAttr('disabled');
    $(this).closest('.control-group-buttons').remove();
  });

  $('#form input:file').change(function (e) {
    e.preventDefault();
    var $this = $(this);
    var $cgw = $this.closest('.control-group-wrap');
    $('#form input,textarea').not($this).attr('disabled', true);
    var file = this.files[0];
    // var name = file.name;
    var size = file.size;
    var type = file.type;
    var $validation = $cgw.find('.validation');
    if ($validation.length) {
      $validation = $($validation[0]);
    } else {
      $validation = $('<div class="validation"></div>').appendTo($cgw.find('.controls'));
    }
    if (!(/(\.|\/)(gif|jpe?g|png)$/i).test(type)) {
      $validation.html('<p class="text-error">' + type + ' is not allowed to upload</p>');
      return;
    }
    if (size > 5000000) {
      $validation.html('<p class="text-error">' + size + ' is too large to upload</p>');
      return;
    }
    // clear validation message if any
    $validation.empty();

    if ($cgw.children('.control-group-buttons').length === 0) {
      $cgw.prepend('<div class="pull-right control-group-buttons"><button value="upload" class="btn btn-primary">Upload</button></div>');
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
    data.append('file', input.files[0]);
    $.ajax({
      url: './uploads/',
      type: 'POST',
      processData: false,
      contentType: false, // important for jqXHR
      data: data
    }).done(function (data, status, jqXHR) {
      var timestamp = jqXHR.getResponseHeader('Date');
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>File uploaded ' + moment(timestamp).fromNow() + '</div>');
      // var $history = $this.closest('.control-group-wrap').find('.history');
      // if ($history.length) {
      //   $history = $($history[0]);
      // } else {
      //   $history = $('<div class="history"/>').appendTo($this.closest('.control-group-wrap').find('.controls'));
      // }
      // $history.html('changed to <strong>' + binder.accessor.target[input.name] + '</strong> by me ' + moment(timestamp).fromNow() + '; ' + $history.html());
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR, status, error) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot upload the file: ' + (jqXHR.responseText || 'unknown') + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }).always(function () {
      $this.removeAttr('disabled');
      $('#form input,textarea').removeAttr('disabled');
    }
    );

  });

});

function history(found) {
  var i, output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      output = output + 'changed to <strong>' + found[i].value + '</strong> by ' + found[i].inputBy + ' ' + moment(found[i].inputOn).fromNow() + '; ';
    }
  }
  return output;
}
