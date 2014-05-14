/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false*/
/*global selectColumn: false, formLinkColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, fnAddFilterFoot: false, sDom: false, oTableTools: false, fnSelectAll: false, fnDeselect: false, createdByColumn: false, createdOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false*/

function initTable(oTable, url) {
  $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json'
  }).done(function (json) {
    oTable.fnClearTable();
    oTable.fnAddData(json);
    oTable.fnDraw();
  }).fail(function (jqXHR, status, error) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms and travelers.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();
}

function formatTravelerStatus(s) {
  var status = {
    '1': 'active',
    '1.5': 'submitted for completion',
    '2': 'completed',
    '3': 'frozen',
    '0': 'initialized'
  };
  if (status['' + s]) {
    return status['' + s];
  }
  return 'unknown';
}


$(function () {
  $(document).ajaxError(function (event, jqXHR, settings, exception) {
    if (jqXHR.status == 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="/" target="_blank">home</a>, log in, and then save the changes on this page.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });

  var currentTravelerAoColumns = [travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, createdByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#current-traveler-table', currentTravelerAoColumns);
  currentTravelerTable = $('#current-traveler-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: currentTravelerAoColumns,
    aaSorting: [
      [6, 'desc'],
      [8, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });


  initTable(currentTravelerTable, '/currenttravelers/json?device='+device);

  // binding events
  filterEvent();
});
