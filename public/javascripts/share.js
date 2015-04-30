/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, prefix: false, Bloodhound: false*/
/*global selectColumn: false, useridColumn: false, userNameNoLinkColumn: false, groupNameColumn: false, accessColumn: false, sDom: false, oTableTools: false, fnGetSelected: false, selectEvent: false, filterEvent: false*/


var path = window.location.pathname;


function initTable(list, oTable) {
  $.ajax({
    url: path + list + '/json',
    type: 'GET',
    dataType: 'json'
  }).done(function (json) {
    oTable.fnClearTable();
    oTable.fnAddData(json);
    oTable.fnDraw();
  }).fail(function (jqXHR, status, error) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for sharing information.</div>');
    }
  });
}


function removeFromModal(list, cb) {
  $('#remove').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    $.ajax({
      url: path + list + '/' + that.id,
      type: 'DELETE'
    }).done(function () {
      $(that).wrap('<del></del>');
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

function remove(list, oTable) {
  var selected = fnGetSelected(oTable, 'row-selected');
  if (selected.length) {
    $('#modalLabel').html('Remove the following ' + selected.length + ' ' + list + '? ');
    $('#modal .modal-body').empty();
    selected.forEach(function (row) {
      var data = oTable.fnGetData(row);
      if (list === 'users') {
        $('#modal .modal-body').append('<div id="' + data._id + '"">' + data.username + '</div>');
      }
      if (list === 'groups') {
        $('#modal .modal-body').append('<div id="' + data._id + '"">' + data.groupname + '</div>');
      }
    });
    $('#modal .modal-footer').html('<button id="remove" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
    $('#remove').click(function (e) {
      e.preventDefault();
      $('#remove').prop('disabled', true);
      removeFromModal(list, function () {
        initTable(list, oTable);
      });
    });
    $('#modal').modal('show');
  } else {
    $('#modalLabel').html('Alert');
    $('#modal .modal-body').html('No item has been selected!');
    $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
    $('#modal').modal('show');
  }
}

function modifyFromModal(list, cb) {
  $('#remove').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    $.ajax({
      url: path + list + '/' + that.id,
      type: 'PUT',
      contentType: 'application/json',
      processData: false,
      data: JSON.stringify({
        access: $('#modal-access').prop('checked') ? 'write' : 'read'
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

function modify(list, oTable) {
  var selected = fnGetSelected(oTable, 'row-selected');
  if (selected.length) {
    $('#modalLabel').html('Modify the following ' + selected.length + ' ' + list + '\' privilege? ');
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append('<form class="form-inline"><lable class="checkbox"><input id="modal-access" type="checkbox" name="access" value="write">write</lable></form>');
    selected.forEach(function (row) {
      var data = oTable.fnGetData(row);
      if (list === 'users') {
        $('#modal .modal-body').append('<div id="' + data._id + '">' + data.username + '</div>');
      }

      if (list === 'groups') {
        $('#modal .modal-body').append('<div id="' + data._id + '">' + data.groupname + '</div>');
      }
    });
    $('#modal .modal-footer').html('<button id="modify" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
    $('#modify').click(function (e) {
      e.preventDefault();
      $('#modify').prop('disabled', true);
      if (list === 'users') {
        modifyFromModal('users', function () {
          initTable('users', oTable);
        });
      }

      if (list === 'groups') {
        modifyFromModal('groups', function () {
          initTable('groups', oTable);
        });
      }
    });
    $('#modal').modal('show');
  } else {
    $('#modalLabel').html('Alert');
    $('#modal .modal-body').html('No item has been selected!');
    $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
    $('#modal').modal('show');
  }
}


function inArray(name, ao) {
  var i;
  for (i = 0; i < ao.length; i += 1) {
    if ((ao[i].username || ao[i]._id) === name) {
      return true;
    }
  }
  return false;
}


function addto(data, table, list) {
  if (inArray(data.name || data.id, table.fnGetData())) {
    //show message
    $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button><strong>' + name + '</strong> is already in the ' + list + ' share list. </div>');
  } else {
    $.ajax({
      url: path + list + '/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(data),
      processData: false,
      success: function (res, status, jqXHR) {
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
        initTable(list, table);
      },
      error: function (jqXHR, status, error) {
        if (jqXHR.status !== 401) {
          $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the ' + list + ' share list : ' + jqXHR.responseText + '</div>');
        }
      }
    });
  }
}


$(function () {
  ajax401(prefix);
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

  travelerGlobal.groupids.initialize();

  $('#groupid').typeahead({
    minLength: 1,
    highlight: true,
    hint: true
  }, {
    name: 'groupids',
    displayKey: 'sAMAccountName',
    limit: 20,
    source: travelerGlobal.groupids
  });

  var shareAoColumns = [selectColumn, useridColumn, userNameNoLinkColumn, accessColumn];
  var shareTable = $('#share-table').dataTable({
    aaData: [],
    // 'bAutoWidth': false,
    aoColumns: shareAoColumns,
    aaSorting: [
      [1, 'desc']
    ],
    sDom: sDomNoTools
  });

  var groupShareAoColumns = [selectColumn, groupNameColumn, accessColumn];
  var groupShareTable = $('#groupshare-table').dataTable({
    aaData: [],
    // 'bAutoWidth': false,
    aoColumns: groupShareAoColumns,
    aaSorting: [
      [1, 'desc']
    ],
    sDom: sDomNoTools
  });

  selectEvent();
  filterEvent();

  $('#add').click(function (e) {
    e.preventDefault();
    var data = {};
    data.name = $('#username').val();
    data.access = $('#access').prop('checked') ? 'write' : 'read';
    addto(data, shareTable, 'users');
    document.forms[0].reset();
  });

  $('#addgroup').click(function (e) {
    e.preventDefault();
    var data = {};
    data.id = $('#groupid').val().toLowerCase();
    data.access = $('#groupaccess').prop('checked') ? 'write' : 'read';
    addto(data, groupShareTable, 'groups');
    document.forms[1].reset();
  });

  $('#share-remove').click(function (e) {
    remove('users', shareTable);
  });

  $('#groupshare-remove').click(function (e) {
    remove('groups', groupShareTable);
  });

  $('#share-modify').click(function (e) {
    modify('users', shareTable);
  });

  $('#groupshare-modify').click(function (e) {
    modify('groups', groupShareTable);
  });

  initTable('users', shareTable);
  initTable('groups', groupShareTable);

});
