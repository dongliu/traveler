/*global deviceTravelerLinkColumn: false, serialColumn: false, typeColumn: false, descriptionColumn: false, fnAddFilterFoot: false, sDom: false, oTableTools: false, filterEvent: false, prefix: false*/
$(function() {
  var aoColumns = [
    deviceTravelerLinkColumn,
    serialColumn,
    typeColumn,
    descriptionColumn,
  ];
  fnAddFilterFoot('#device-table', aoColumns);
  $('#device-table').dataTable({
    sAjaxSource: prefix + '/devices/json',
    sAjaxDataProp: '',
    aoColumns: aoColumns,
    bProcessing: true,
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    sDom: sDom,
    oTableTools: oTableTools,
  });

  filterEvent();
});
