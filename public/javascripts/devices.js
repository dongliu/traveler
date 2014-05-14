$(function(){
  var aoColumns = [deviceTravelerLinkColumn, serialColumn, typeColumn, descriptionColumn, modifiedByColumn, modifiedOnColumn];
  fnAddFilterFoot('#device-table', aoColumns);
  var deviceTable = $('#device-table').dataTable({
    aaData: [],
    // 'bAutoWidth': false,
    aoColumns: aoColumns,
    aaSorting: [
      [5, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });

  filterEvent();

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
