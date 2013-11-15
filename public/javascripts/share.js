var path = window.location.pathname;
$(function() {
  var nameCache = {};

  $('#username').typeahead({
    name: 'usernames',
    valueKey: 'displayName',
    prefetch: '/adusernames'
  });

  var shareAoColumns = [selectColumn, useridColumn, userNameColumn, accessColumn];
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

  $('#add').click(function(e) {
    e.preventDefault();
    var name = $('#username').val();
    if (inArray(name, shareTable.fnGetData())) {
      //show message
      $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The user named <strong>' + name + '</strong> is already in the share list. </div>');
    } else {
      $.ajax({
        url: path + name,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
          access: $('#access').prop('checked') ? 'write' : 'read'
        }),
        success: function(data, status, jqXHR) {
          $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' + jqXHR.responseText + '</div>');
          initTable(shareTable);
        },
        error: function(jqXHR, status, error) {
          $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the share list : ' + jqXHR.responseText + '</div>');
        }
      });
    }
    document.forms[0].reset();
  });

  initTable(shareTable);

});


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
  }).done(function(json) {
    oTable.fnClearTable();
    oTable.fnAddData(json);
    oTable.fnDraw();
  }).fail(function(jqXHR, status, error) {
    $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for sharing information.</div>');
  }).always();
}