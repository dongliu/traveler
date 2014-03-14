/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false*/
/*global travelerStatus: false*/

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
  var i, output = '',
    link;
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      link = '/data/' + found[i]._id;
      output = output + '<strong><a href=' + link + ' target="_blank">' + found[i].value + '</a></strong> uploaded by ' + found[i].inputBy + ' ' + moment(found[i].inputOn).fromNow() + '; ';
    }
  }
  return output;
}

// temparary solution for the dirty forms
function cleanForm() {
  $('.control-group-buttons').remove();
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
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();
}

function createSideNav() {
  var $legend = $('legend');
  var $affix = $('<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>');
  var i;
  if ($legend.length > 1) {
    // $legend.attr('data-spy', 'affix');
    for (i = 0; i < $legend.length; i += 1) {
      $affix.append('<li><a href="#' + $legend[i].id + '">' + $legend[i].textContent + '</a></li>');
    }
    $('body').append($('<div id="affixlist" class="bs-docs-sidebar"></div>').append($affix));
    $('body').attr('data-spy', 'scroll');
    $('body').attr('data-target', '#affixlist');
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
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update finished input number</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();
}

$(function () {
  createSideNav();

  cleanForm();

  $(document).bind('drop dragover', function (e) {
    e.preventDefault();
  });

  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });

  var binder = new Binder.FormBinder(document.forms[0]);
  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json'
  }).done(function (data, status, jqXHR) {
    // var finishedInput = 0;
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
        if (this.type == 'file') {
          $(element).closest('.controls').append('<div class="history">' + fileHistory(found) + '</div>');
        } else {
          binder.deserializeFieldFromValue(element, found[0].value);
          binder.accessor.set(element.name, found[0].value);
          $(element).closest('.controls').append('<div class="history">' + history(found) + '</div>');
        }
        // finishedInput += 1;
      }
    });

    // check if active here
    if (travelerStatus === 1) {
      $('#form input,textarea').removeAttr('disabled');
      // update the finished input count
      // updateFinished(finishedInput);
    }
  }).fail(function (jqXHR, status, error) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
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

  $('#form input:not([type="file"]),textarea').change(function (e) {
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
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Change saved ' + moment(timestamp).fromNow() + '</div>');
      var $history = $this.closest('.control-group-wrap').find('.history');
      if ($history.length) {
        $history = $($history[0]);
      } else {
        // a new finished input
        finishedInput += 1;
        updateFinished(finishedInput);
        $history = $('<div class="history"/>').appendTo($this.closest('.control-group-wrap').find('.controls'));
      }
      $history.html('changed to <strong>' + binder.accessor.target[input.name] + '</strong> by me ' + moment(timestamp).fromNow() + '; ' + $history.html());
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR, status, error) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the value: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
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
      $(input).val('');
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
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>File uploaded ' + moment(timestamp).fromNow() + '</div>');
      var $history = $this.closest('.control-group-wrap').find('.history');
      if ($history.length) {
        $history = $($history[0]);
      } else {
        $history = $('<div class="history"/>').appendTo($this.closest('.control-group-wrap').find('.controls'));
      }
      $history.html('<strong><a href=' + data.location + ' target="_blank">' + input.files[0].name + '</a></strong> uploaded by me ' + moment(timestamp).fromNow() + '; ' + $history.html());
      $this.closest('.control-group-buttons').remove();
    }).fail(function (jqXHR, status, error) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot upload the file: ' + (jqXHR.responseText || 'unknown') + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
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

});
