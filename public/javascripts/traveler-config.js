/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, ajax401: false, Modernizr: false, prefix: false, updateAjaxURL: false, disableAjaxCache: false, Bloodhound: false*/

function setStatus(s) {
  $.ajax({
    url: './status',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      status: s
    })
  }).done(function () {
    // TODO: avoid refresh the whole page
    document.location.href = window.location.pathname;
  }).fail(function (jqXHR) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();
}

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });
  if ($('#deadline').attr('value')) {
    $('#deadline').val(moment($('#deadline').attr('value')).format('YYYY-MM-DD'));
  }
  if (!Modernizr.inputtypes.date) {
    $('#deadline').datepicker({
      format: 'yyyy-mm-dd'
    });
  }
  var initValue = {
    title: $('#title').text(),
    description: $('#description').text()
  };

  $('span.editable').editable(function (value) {
    var that = this;
    if (value === initValue[that.id]) {
      return value;
    }
    var data = {};
    data[that.id] = value;
    $.ajax({
      url: './config',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: function (json) {
        initValue[that.id] = json[that.id];
        $(that).text(json[that.id]);
      },
      error: function (jqXHR) {
        $(that).text(initValue[that.id]);
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot update the traveler config : ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
    return '';
  }, {
    type: 'textarea',
    rows: 1,
    cols: 35,
    style: 'display: inline',
    cancel: 'Cancel',
    submit: 'Update',
    indicator: 'Updating...',
    tooltip: 'Click to edit...'
  });

  $('button.editable').click(function () {
    $(this).siblings('span.editable').first().click();
  });

  var deadline = $('#deadline').val();

  $('#deadline').change(function () {
    var $dl = $(this).parent();
    if ($dl.children('.buttons').length === 0) {
      $dl.append('<span class="buttons"><button value="save" class="btn btn-primary">Save</button> <button value="reset" class="btn">Reset</button></span>');
    }
  });

  $('#deadline').parent().on('click', 'button[value="save"]', function (e) {
    e.preventDefault();
    var $this = $(this);
    var $input = $this.closest('.form-inline').children('input').first();
    $.ajax({
      url: './config',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        deadline: moment($input.val()).utc()
      })
    }).done(function () {
      deadline = $input.val();
      $this.parent().remove();
    }).fail(function (jqXHR) {
      $this.val(deadline);
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot update the traveler config :  ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
  });

  $('#deadline').parent().on('click', 'button[value="reset"]', function (e) {
    e.preventDefault();
    var $this = $(this);
    $this.closest('.form-inline').children('input').first().val(deadline);
    $this.parent().remove();
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


  /* A general way to add and remove tag, tag include deveice and location */
  var devices;
  // event delegation for ajax generated content
  $('ul').on('click', '.remove-tag', function (e) {
    e.preventDefault();
    var $that = $(this);
    var tagName = $(this).attr('name');
    $.ajax({
      url: './' + tagName + '/' + encodeURIComponent($that.siblings('span').text()),
      type: 'DELETE'
    }).done(function () {
      $that.closest('li').remove();
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot remove the ' + tagName + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    }).always();
  });

  $('.add-tag').click(function (e) {
    e.preventDefault();
    // add an input text and a button
    $(this).attr('disabled', true);
    var tagName = $(this).attr('name');
    $('#' + tagName).append('<li><form class="form-inline"><input class="newTag" type="text" name="' + tagName + '"> ' +
      '<button class="btn btn-primary confirm" name="' + tagName + '">Confirm</button> ' +
      '<button class="btn cancel" name="' + tagName + '">Cancel</button></form></li>');

    // if the tag is for devices
    if(tagName === 'devices') {
      // load devices
      if (!devices) {
        devices = new Bloodhound({
          datumTokenizer: function (device) {
            return Bloodhound.tokenizers.nonword(device.inventoryId);
          },
          queryTokenizer: Bloodhound.tokenizers.nonword,
          identify: function (device) {
            return device.inventoryId;
          },
          prefetch: {
            url: prefix + '/devices/json',
            cacheKey: 'devices'
          }
        });
        devices.initialize();
      }
      // autocomplete
      $('#devices .newTag:first').typeahead({
        minLength: 1,
        highlight: true,
        hint: true
      }, {
        name: 'devices',
        limit: 20,
        display: 'inventoryId',
        source: devices
      });
    }
  });

  $('ul').on('click', '.cancel', function (cancelE) {
    cancelE.preventDefault();
    $(this).closest('li').remove();
    var tagName = $(this).attr('name');
    $('.add-tag[name="' + tagName + '"]').removeAttr('disabled');
  });

  $('ul').on('click', '.confirm', function (confirmE) {
    confirmE.preventDefault();
    var tagName = $(this).attr('name');
    var content = $('.newTag[name="' + tagName + '"]').val().trim();
    var $that = $(this);
    if (content) {
      $.ajax({
        url: './tags/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          newtag: content,
          tagName: tagName
        })
      }).done(function (data, textStatus, jqXHR) {
        if (jqXHR.status === 204) {
          return;
        }
        if (jqXHR.status === 200) {
          $('#' + tagName).append('<li><span>' + data.tag + '</span> <button class="btn btn-sm btn-warning remove-tag" name="' + tagName + '"><i class="fa fa-trash-o fa-lg"></i></button></li>');
        }
      }).fail(function (jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append('<div class="alert alert-danger"><button class="close" data-dismiss="alert">x</button>Cannot add the ' + tagName + '</div>');
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      }).always(function () {
        $that.closest('li').remove();
        $('.add-tag[name="' + tagName + '"]').removeAttr('disabled');
      });
    }
  });
});
