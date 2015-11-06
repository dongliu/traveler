/*global selectColumn: false, useridColumn: false, fullNameNoLinkColumn: false, rolesColumn: false, lastVisitedOnColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, sDom: false, oTableTools: false*/
/*global updateAjaxURL: false, prefix: false*/
/*global Bloodhound: false, travelerGlobal: false*/

function inArray(name, ao) {
  var i;
  for (i = 0; i < ao.length; i += 1) {
    if (ao[i].name === name) {
      return true;
    }
  }
  return false;
}

function initTable(oTable) {
  $.ajax({
    url: '/users/json',
    type: 'GET',
    dataType: 'json'
  }).done(function (json) {
    oTable.fnClearTable();
    oTable.fnAddData(json);
    oTable.fnDraw();
  }).fail(function (jqXHR, status, error) {
    $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for users information.</div>');
  }).always();
}

function updateFromModal(cb) {
  $('#remove').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    $.ajax({
      url: '/users/' + that.id + '/refresh',
      type: 'GET'
    }).done(function () {
      $(that).prepend('<i class="icon-check"></i>');
      $(that).addClass('text-success');
    }).fail(function (jqXHR, status, error) {
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
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
  var roles = [];
  $('#modal-roles input:checked').each(function () {
    roles.push($(this).val());
  });
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    $.ajax({
      url: '/users/' + that.id,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        roles: roles
      })
    }).done(function () {
      $(that).prepend('<i class="icon-check"></i>');
      $(that).addClass('text-success');
    }).fail(function (jqXHR, status, error) {
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0) {
        if (cb) {
          cb();
        }
      }
    });
  });
}

$(function () {
  updateAjaxURL(prefix);

  travelerGlobal.usernames.initialize();

  $('#username').typeahead({
    minLength: 1,
    highlight: true,
    hint: true
  }, {
    name: 'usernames',
    display: 'displayName',
    limit: 20,
    source: travelerGlobal.usernames
  });

  var userTable = $('#users').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: [selectColumn, useridColumn, fullNameNoLinkColumn, rolesColumn, lastVisitedOnColumn],
    aaSorting: [
      [4, 'desc'],
      [1, 'asc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  selectEvent();
  filterEvent();

  $('#add').click(function (e) {
    e.preventDefault();
    var name = $('#username').val();
    if (inArray(name, userTable.fnGetData())) {
      //show message
      $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The user named <strong>' + name + '</strong> is already in the user list. </div>');
    } else {
      $.ajax({
        url: '/users/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          name: name,
          manager: $('#manager').prop('checked'),
          admin: $('#admin').prop('checked'),
          read_all_forms: $('#read_all_forms').prop('checked')
        }),
        success: function (data, status, jqXHR) {
          $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
          initTable(userTable);
        },
        error: function (jqXHR, status, error) {
          $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the share list : ' + jqXHR.responseText + '</div>');
        }
      });
    }
    document.forms[0].reset();
  });

  $('#user-update').click(function (e) {
    var selected = fnGetSelected(userTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html('Update the following ' + selected.length + ' users from the application? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = userTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '">' + data.name + '</div>');
      });
      $('#modal .modal-footer').html('<button id="update" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#update').click(function (e) {
        e.preventDefault();
        $('#update').prop('disabled', true);
        updateFromModal(function () {
          initTable(userTable);
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

  $('#user-modify').click(function (e) {
    var selected = fnGetSelected(userTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html('Modify the following ' + selected.length + ' users\' role? ');
      $('#modal .modal-body').empty();
      $('#modal .modal-body').append(
          '<form id="modal-roles" class="form-inline">' +
          '<label class="checkbox"><input id="modal-manager" type="checkbox" value="manager">manager</label> ' +
          '<label class="checkbox"><input id="modal-admin" type="checkbox" value="admin">admin</label> ' +
          '<label class="checkbox"><input id="read_all_forms" type="checkbox" value="read_all_forms">read_all_forms</label> ' +
          '</form>');
      selected.forEach(function (row) {
        var data = userTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '">' + data.name + '</div>');
      });
      $('#modal .modal-footer').html('<button id="modify" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modify').click(function (e) {
        e.preventDefault();
        $('#modify').prop('disabled', true);
        modifyFromModal(function () {
          initTable(userTable);
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


  initTable(userTable);
});
