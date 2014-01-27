/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false*/

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
  }).done(function (data, status, jqXHR) {
    document.location.href = window.location.pathname;
  }).fail(function (jqXHR, status, error) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();
}

$(function () {
  var initValue = {
    title: $('#title').text(),
    description: $('#description').text()
  };

  $('span.editable').editable(function (value, settings) {
    var that = this;
    if (value === initValue[that.id]) {
      // console.log('not changed');
      return value;
    }
    var data = {};
    data[that.id] = value;
    $.ajax({
      url: './config',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: function (data) {
        initValue[that.id] = value;
      },
      error: function (jqXHR, status, error) {
        $(that).text(initValue[that.id]);
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the traveler config : ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
    return value;
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

  $('button.editable').click(function (e) {
    $(this).siblings('span.editable').first().click();
  });

  $('#add').click(function (e) {
    e.preventDefault();
    // add an input and a button add
    $('#add').attr('disabled', true);
    $('#devices').append('<li><form class="form-inline"><input id="newDevice" type="text"> <button id="confirm" class="btn btn-primary">Confirm</button> <button id="cancel" class="btn">Cancel</button></form></li>');
    $('#cancel').click(function (e) {
      e.preventDefault();
      // $('#newDevice').closest('li').remove();
      // $('#add').removeAttr('disabled');
      cleanDeviceForm();
    });
    $('#newDevice').typeahead({
      name: 'devices',
      valueKey: 'serialNumber',
      prefetch: '/devices/json'
    });
    $('#confirm').click(function (e) {
      e.preventDefault();
      if ($('#newDevice').val()) {
        $.ajax({
          url: './devices/',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            newdevice: $('#newDevice').val()
          })
        }).done(function (data, status, jqXHR) {
          document.location.href = window.location.pathname;
        }).fail(function (jqXHR, status, error) {
          $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot add the device</div>');
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }).always();
      }
      cleanDeviceForm();
    });
  });

  $('.removeDevice').click(function (e) {
    e.preventDefault();
    var $that = $(this);
    $.ajax({
      url: './devices/' + $that.closest('li').text(),
      type: 'DELETE'
    }).done(function (data, status, jqXHR) {
      $that.closest('li').remove();
    }).fail(function (jqXHR, status, error) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot remove the device</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
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
