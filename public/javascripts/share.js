$(function() {
  // var users = [];
  var nameCache = {};

  $('#user-name').autocomplete(nameAuto('#user-name', nameCache));

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

  var path = window.location.pathname;
  $.ajax({
    url: path+'/json',
    type: 'GET',
    dataType: 'json'
  }).done(function(json) {
    shareTable.fnClearTable();
    shareTable.fnAddData(json);
    shareTable.fnDraw();
  }).fail(function(jqXHR, status, error) {
    $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for sharing information.</div>');
  }).always();

});
