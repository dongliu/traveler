var path = window.location.pathname;
$(function () {
  $(document).ajaxError(function (event, jqXHR, settings, exception) {
    if (jqXHR.status == 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="/" target="_blank">home</a>, log in, and then save the changes on this page.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });
  $('#username').typeahead({
    name: 'usernames',
    limit: 20,
    valueKey: 'displayName',
    prefetch: prefix + '/adusernames'
  });

  var shareAoColumns = [selectColumn, useridColumn, userNameNoLinkColumn, accessColumn];
  var shareTable = $('#share-table').dataTable({
    aaData: [],
    // 'bAutoWidth': false,
    aoColumns: shareAoColumns,
    aaSorting: [
      [1, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });

  selectEvent();
  filterEvent();

  $('#add').click(function (e) {
    e.preventDefault();
    var name = $('#username').val();
    if (inArray(name, shareTable.fnGetData())) {
      //show message
      $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The user named <strong>' + name + '</strong> is already in the share list. </div>');
    } else {
      $.ajax({
        url: path,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          name: name,
          access: $('#access').prop('checked') ? 'write' : 'read'
        }),
        success: function (data, status, jqXHR) {
          $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
          initTable(shareTable);
        },
        error: function (jqXHR, status, error) {
          if (jqXHR.status !== 401) {
            $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the share list : ' + jqXHR.responseText + '</div>');
          }
        }
      });
    }
    document.forms[0].reset();
  });

  $('#share-remove').click(function (e) {
    var selected = fnGetSelected(shareTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html('Remove the following ' + selected.length + ' users from the share list? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = shareTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '"">' + data.username + '</div>');
      });
      $('#modal .modal-footer').html('<button id="remove" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#remove').click(function (e) {
        e.preventDefault();
        $('#remove').prop('disabled', true);
        removeFromModal(function () {
          initTable(shareTable);
        });
      });
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No users has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    }
  });

  $('#share-modify').click(function (e) {
    var selected = fnGetSelected(shareTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html('Modify the following ' + selected.length + ' users\' privilege? ');
      $('#modal .modal-body').empty();
      $('#modal .modal-body').append('<form class="form-inline"><lable class="checkbox"><input id="modal-access" type="checkbox" name="access" value="write">write</lable></form>');
      selected.forEach(function (row) {
        var data = shareTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '"">' + data.username + '</div>');
      });
      $('#modal .modal-footer').html('<button id="modify" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modify').click(function (e) {
        e.preventDefault();
        $('#modify').prop('disabled', true);
        modifyFromModal(function () {
          initTable(shareTable);
        });
      });
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No users has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    }
  });

  initTable(shareTable);

});

function removeFromModal(cb) {
  $('#remove').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    $.ajax({
      url: path + that.id,
      type: 'DELETE'
    }).done(function () {
      $(that).wrap('<del></del>');
      $(that).addClass('text-success');
    })
      .fail(function (jqXHR, status, error) {
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function () {
        number = number - 1;
        if (number === 0) {
          if (cb) {
            cb();
          }
        }
      });
  });
}

function modifyFromModal(cb) {
  $('#remove').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    $.ajax({
      url: path + that.id,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        access: $('#modal-access').prop('checked') ? 'write' : 'read'
      }),
    }).done(function () {
      $(that).prepend('<i class="icon-check"></i>');
      $(that).addClass('text-success');
    })
      .fail(function (jqXHR, status, error) {
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function () {
        number = number - 1;
        if (number === 0) {
          if (cb) {
            cb();
          }
        }
      });
  });
}


function inArray(name, ao) {
  for (var i = 0; i < ao.length; i += 1) {
    if (ao[i]['username'] == name) {
      return true;
    }
  }
  return false;
}

function initTable(oTable) {
  $.ajax({
    url: path + 'json',
    type: 'GET',
    dataType: 'json'
  }).done(function (json) {
    oTable.fnClearTable();
    oTable.fnAddData(json);
    oTable.fnDraw();
  }).fail(function (jqXHR, status, error) {
    if (jqXHR.status == 401) {
      $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for sharing information.</div>');
    }
  }).always();
}
