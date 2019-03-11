/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false*/
/*global selectColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, filledByColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, sDomNoTools: false, createdOnColumn: false, transferredOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, ownerColumn: false, deadlineColumn: /*global travelerLinkColumn: false, titleColumn: false, ownerColumn: false, deviceColumn: false, createdOnColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, createdByColumn: false, createdOnColumn: false, sDomNoTools: false, filterEvent: false, Holder: false*/

function noneSelectedModal() {
  $('#modalLabel').html('Alert');
  $('#modal .modal-body').html('No traveler has been selected!');
  $('#modal .modal-footer').html(
    '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  // var publicTravelersAoColumns = [travelerLinkColumn, titleColumn, createdByColumn, createdOnColumn, ownerColumn, deviceColumn, sharedWithColumn, sharedGroupColumn];
  var publicTravelersAoColumns = [
    selectColumn,
    travelerLinkColumn,
    titleColumn,
    statusColumn,
    deviceColumn,
    tagsColumn,
    keysColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdOnColumn,
    deadlineColumn,
    filledByColumn,
    updatedOnColumn,
    travelerProgressColumn,
  ];
  fnAddFilterFoot('#public-travelers-table', publicTravelersAoColumns);
  $('#public-travelers-table').dataTable({
    sAjaxSource: '/publictravelers/json',
    sAjaxDataProp: '',
    fnDrawCallback: function() {
      Holder.run({
        images: 'img.user',
      });
    },
    bAutoWidth: false,
    bProcessing: true,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: publicTravelersAoColumns,
    aaSorting: [
      // [3, 'desc']
      [12, 'desc'],
      [9, 'desc'],
    ],
    sDom: sDomNoTools,
  });

  $('#report').click(function() {
    var activeTable = $('.table.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      noneSelectedModal();
      return;
    }
    $('#report-form').empty();
    selected.forEach(function(row) {
      var data = activeTable.fnGetData(row);
      $('#report-form').append(
        $('<input type="hidden"/>').attr({
          name: 'travelers[]',
          value: data._id,
        })
      );
    });
    $('#report-form').submit();
  });

  $('button.select-all').click(function() {
    var activeTable = $('.table.active table').dataTable();
    fnSelectAll(activeTable, 'row-selected', 'select-row', true);
  });

  $('button.deselect-all').click(function() {
    var activeTable = $('.table.active table').dataTable();
    fnDeselect(activeTable, 'row-selected', 'select-row');
  });

  // binding events
  selectEvent();
  filterEvent();
});
