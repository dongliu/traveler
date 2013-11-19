$(function(){
  var aoColumns = [serialColumn, typeColumn, descriptionColumn, modifiedByColumn, modifiedOnColumn];
  var deviceTable = $('#device-table').dataTable({
    aaData: [],
    // 'bAutoWidth': false,
    aoColumns: aoColumns,
    aaSorting: [
      [1, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });

  $.ajax({
    url: '/devices/json',
    type: 'GET',
    dataType: 'json'
  }).done(function(json) {
    deviceTable.fnClearTable();
    deviceTable.fnAddData(json);
    deviceTable.fnDraw();
  }).fail(function(jqXHR, status, error) {
    $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for device information.</div>');
  }).always();
});