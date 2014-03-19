function inArray(name, ao) {
  for (var i = 0; i < ao.length; i += 1) {
    if (ao[i]['name'] == name) {
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

$(function () {
  $('#username').typeahead({
    name: 'usernames',
    limit: 20,
    valueKey: 'displayName',
    prefetch: '/adusernames'
  });

  var userTable = $('#users').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: [selectColumn, useridColumn, userNameNoLinkColumn, rolesColumn, lastVisitedOnColumn],
    aaSorting: [
      [1, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  selectEvent();
  filterEvent();

  $('#add').click(function(e) {
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
          admin: $('#admin').prop('checked')
        }),
        success: function(data, status, jqXHR) {
          $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
          initTable(userTable);
        },
        error: function(jqXHR, status, error) {
          $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the share list : ' + jqXHR.responseText + '</div>');
        }
      });
    }
    document.forms[0].reset();
  });

  $('#share-remove').click(function(e) {
    var selected = fnGetSelected(shareTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html('Remove the following ' + selected.length + ' users from the share list? ');
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = shareTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '"">' + data.username + '</div>');
      });
      $('#modal .modal-footer').html('<button id="remove" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#remove').click(function(e){
        e.preventDefault();
        removeFromModal(function(){
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

  $('#share-modify').click(function(e) {
    var selected = fnGetSelected(shareTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html('Modify the following ' + selected.length + ' users\' priviledge? ');
      $('#modal .modal-body').empty();
      $('#modal .modal-body').append('<form class="form-inline"><lable class="checkbox"><input id="modal-access" type="checkbox" name="access" value="write">write</lable></form>');
      selected.forEach(function(row) {
        var data = shareTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '"">' + data.username + '</div>');
      });
      $('#modal .modal-footer').html('<button id="modify" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modify').click(function(e) {
        e.preventDefault();
        modifyFromModal(function() {
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


  initTable(userTable);
});


