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


$(function () {
  $(document).ajaxError(function (event, jqXHR, settings, exception) {
    if (jqXHR.status == 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="/" target="_blank">home</a>, log in, and then save the changes on this page.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });

  var formAoColumns = [selectColumn, formLinkColumn, formShareLinkColumn, titleColumn, createdOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn];
  fnAddFilterFoot('#form-table', formAoColumns);
  var formTable = $('#form-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: formAoColumns,
    aaSorting: [
      [4, 'desc'],
      [5, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(formTable, '/forms/json');

  $('#form-select-all').click(function (e) {
    fnSelectAll(formTable, 'row-selected', 'select-row', true);
  });

  $('#form-select-none').click(function (e) {
    fnDeselect(formTable, 'row-selected', 'select-row');
  });

  var sharedFormAoColumns = [formLinkColumn, titleColumn, createdByColumn, createdOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn];
  fnAddFilterFoot('#shared-form-table', sharedFormAoColumns);
  var sharedFormTable = $('#shared-form-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: sharedFormAoColumns,
    aaSorting: [
      [3, 'desc'],
      [5, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(sharedFormTable, '/sharedforms/json');

  var travelerAoColumns = [travelerConfigLinkColumn, travelerShareLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#traveler-table', travelerAoColumns);
  var travelerTable = $('#traveler-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: travelerAoColumns,
    aaSorting: [
      [7, 'desc'],
      [9, 'desc'],
      [8, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(travelerTable, '/travelers/json');


  var sharedTravelerAoColumns = [travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, createdByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#shared-traveler-table', sharedTravelerAoColumns);
  var sharedTravelerTable = $('#shared-traveler-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: sharedTravelerAoColumns,
    aaSorting: [
      [6, 'desc'],
      [8, 'desc'],
      [7, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(sharedTravelerTable, '/sharedtravelers/json');

  // if ($('#all-traveler-table').length) {
  var allTravelerAoColumns = [travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, createdByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#all-traveler-table', allTravelerAoColumns);
  var allTravelerTable = $('#all-traveler-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: allTravelerAoColumns,
    aaSorting: [
      [6, 'desc'],
      [8, 'desc'],
      [7, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(allTravelerTable, '/alltravelers/json');
  // }

  $('#form-travel').click(function (e) {
    var selected = fnGetSelected(formTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else if (selected.length > 1) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('Only one selected form is allowed for this action!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $.ajax({
        url: '/travelers/',
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({
          form: formTable.fnGetData(selected[0])._id
        })
      }).done(function (json) {
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>A new traveler is created at <a href="' + json.location + '">' + json.location + '</a></div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
        // initTable();
      }).fail(function (jqXHR, status, error) {
        if (jqXHR.status !== 401) {
          $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot create new traveler</div>');
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      }).always();
    }
  });

  $('#reload').click(function (e) {
    initTable(formTable, '/forms/json');
    initTable(sharedFormTable, '/sharedforms/json');
    initTable(travelerTable, '/travelers/json');
    initTable(sharedTravelerTable, '/sharedtravelers/json');
    // if ($('#all-traveler-table').length) {
    initTable(allTravelerTable, '/alltravelers/json');
    // }
  });

  // binding events
  selectEvent();
  filterEvent();
});
