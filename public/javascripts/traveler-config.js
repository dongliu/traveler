/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, ajax401: false, Modernizr: false, prefix: false, updateAjaxURL: false, disableAjaxCache: false, Bloodhound: false*/

function cleanDeviceForm() {
  $('#newDevice').closest('li').remove();
  $('#add').removeAttr('disabled');
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
    // TODO: avoid refresh the whole page
    document.location.href = window.location.pathname;
  }).fail(function (jqXHR) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
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
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the traveler config : ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
    return '';
  }, {
    type: 'textarea',
    rows: 1,
    cols: 120,
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
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the traveler config :  ' + jqXHR.responseText + '</div>');
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

  var devices;

  $('#add').click(function (e) {
    e.preventDefault();
    // add an input and a button add
    $('#add').attr('disabled', true);
    $('#devices').append('<li><form class="form-inline"><input id="newDevice" type="text"> <button id="confirm" class="btn btn-primary">Confirm</button> <button id="cancel" class="btn">Cancel</button></form></li>');
    $('#cancel').click(function (cancelE) {
      cancelE.preventDefault();
      cleanDeviceForm();
    });

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

    $('#newDevice').typeahead({
      minLength: 1,
      highlight: true,
      hint: true
    }, {
      name: 'devices',
      limit: 20,
      display: 'inventoryId',
      source: devices
    });

    $('#confirm').click(function (confirmE) {
      confirmE.preventDefault();
      if ($('#newDevice').val().trim()) {
        $.ajax({
          url: './devices/',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            newdevice: $('#newDevice').val().trim()
          })
        }).done(function (data, textStatus, jqXHR) {
          if (jqXHR.status === 204) {
            return;
          }
          if (jqXHR.status === 200) {
            $('#devices').append('<li><span class="device">' + data.device + '</span> <button class="btn btn-small btn-warning removeDevice"><i class="fa fa-trash-o fa-lg"></i></button></li>');
          }
        }).fail(function (jqXHR) {
          if (jqXHR.status !== 401) {
            $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot add the device</div>');
            $(window).scrollTop($('#message div:last-child').offset().top - 40);
          }
        }).always(function () {
          cleanDeviceForm();
        });
      }
    });
  });

  $('#devices').on('click', '.removeDevice', function (e) {
    e.preventDefault();
    var $that = $(this);
    $.ajax({
      url: './devices/' + encodeURIComponent($that.siblings('span.device').text()),
      type: 'DELETE'
    }).done(function () {
      $that.closest('li').remove();
    }).fail(function (jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot remove the device</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    }).always();
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

});
