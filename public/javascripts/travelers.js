/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false, History: false */
/*global moment: false, Binder: false, ajax401: false, prefix: false, updateAjaxURL: false*/
/*global selectColumn: false, formLinkColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, sDom: false, sDomNoTools: false, oTableTools: false, fnSelectAll: false, fnDeselect: false, createdByColumn: false, createdOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, formShareLinkColumn: false, clonedByColumn: false, deadlineColumn: false, progressColumn: false*/

// var formTable, sharedFormTable, groupSharedFormTable, travelerTable, sharedTravelerTable, groupSharedTravelerTable, initTravelerTable, activeTravelerTable, completeTravelerTable, frozenTravelerTable, archivedTravelerTable;

// function initTable(oTable, url) {
//   $.ajax({
//     url: url,
//     type: 'GET',
//     dataType: 'json'
//   }).done(function (json) {
//     oTable.fnClearTable();
//     oTable.fnAddData(json);
//     oTable.fnDraw();
//   }).fail(function (jqXHR, status, error) {
//     if (jqXHR.status !== 401) {
//       $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms and travelers.</div>');
//       $(window).scrollTop($('#message div:last-child').offset().top - 40);
//     }
//   }).always();
// }

// function initTableFromArray(oTable, json) {
//   oTable.fnClearTable();
//   oTable.fnAddData(json);
//   oTable.fnDraw();
// }

// function initCurrentTables(url) {
//   $.ajax({
//     url: url,
//     type: 'GET',
//     dataType: 'json'
//   }).done(function (json) {
//     var init = json.filter(function (element) {
//       return (element.status === 0);
//     });
//     initTableFromArray(initTravelerTable, init);

//     var active = json.filter(function (element) {
//       return (element.status === 1);
//     });
//     initTableFromArray(activeTravelerTable, active);

//     var complete = json.filter(function (element) {
//       return (element.status === 1.5 || element.status === 2);
//     });
//     initTableFromArray(completeTravelerTable, complete);

//     var frozen = json.filter(function (element) {
//       return (element.status === 3);
//     });
//     initTableFromArray(frozenTravelerTable, frozen);

//   }).fail(function (jqXHR, status, error) {
//     if (jqXHR.status !== 401) {
//       $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms and travelers.</div>');
//       $(window).scrollTop($('#message div:last-child').offset().top - 40);
//     }
//   }).always();
// }

function formatTravelerStatus(s) {
  var status = {
    '1': 'active',
    '1.5': 'submitted for completion',
    '2': 'completed',
    '3': 'frozen',
    '0': 'initialized'
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
}

function travelFromModal() {
  $('#submit').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    var success = false;
    $.ajax({
      url: '/travelers/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        form: this.id
      })
    }).done(function () {
      $(that).prepend('<i class="icon-check"></i>');
      $(that).addClass('text-success');
      success = true;
    })
      .fail(function (jqXHR, status, error) {
        $(that).prepend('<i class="icon-question"></i>');
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function () {
        number = number - 1;
        if (number === 0 && success) {
        }
      });
  });
}


function archiveFromModal(archive) {
  $('#submit').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    var success = false;
    $.ajax({
      url: '/travelers/' + that.id + '/archived',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        archived: archive
      })
    }).done(function () {
      $(that).prepend('<i class="icon-check"></i>');
      $(that).addClass('text-success');
      success = true;
    })
      .fail(function (jqXHR, status, error) {
        $(that).prepend('<i class="icon-question"></i>');
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function () {
        number = number - 1;
        if (number === 0 && success) {
        }
      });
  });
}

function cloneFromModal() {
  $('#submit').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    var success = false;
    $.ajax({
      url: '/travelers/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        source: this.id
      })
    }).done(function () {
      $(that).prepend('<i class="icon-check"></i>');
      $(that).addClass('text-success');
      success = true;
    })
      .fail(function (jqXHR, status, error) {
        $(that).prepend('<i class="icon-question"></i>');
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function () {
        number = number - 1;
        if (number === 0 && success) {
        }
      });
  });
}


$(function () {

  ajax401(prefix);

  updateAjaxURL(prefix);

  var travelerAoColumns = [selectColumn, travelerConfigLinkColumn, travelerShareLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, clonedByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#traveler-table', travelerAoColumns);
  var travelerTable = $('#traveler-table').dataTable({
    sAjaxSource: '/travelers/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, "All"]
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: travelerAoColumns,
    aaSorting: [
      [10, 'desc'],
      [13, 'desc']
    ],
    sDom: sDomNoTools
  });

  var sharedTravelerAoColumns = [selectColumn, travelerConfigLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, createdByColumn, clonedByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#shared-traveler-table', sharedTravelerAoColumns);
  var sharedTravelerTable = $('#shared-traveler-table').dataTable({
    sAjaxSource: '/sharedtravelers/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, "All"]
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: sharedTravelerAoColumns,
    aaSorting: [
      [10, 'desc'],
      [13, 'desc']
    ],
    sDom: sDomNoTools
  });

  var groupSharedTravelerAoColumns = [selectColumn, travelerConfigLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, createdByColumn, clonedByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#group-shared-traveler-table', sharedTravelerAoColumns);
  var groupSharedTravelerTable = $('#group-shared-traveler-table').dataTable({
    sAjaxSource: '/groupsharedtravelers/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, "All"]
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: groupSharedTravelerAoColumns,
    aaSorting: [
      [10, 'desc'],
      [13, 'desc']
    ],
    sDom: sDomNoTools
  });

  var archivedTravelerAoColumns = [selectColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, createdByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#archived-traveler-table', archivedTravelerAoColumns);
  var archivedTravelerTable = $('#archived-traveler-table').dataTable({
    sAjaxSource: '/archivedtravelers/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, "All"]
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: archivedTravelerAoColumns,
    aaSorting: [
      [8, 'desc'],
      [11, 'desc']
    ],
    sDom: sDomNoTools
  });

  // show the tab in hash
  if (History.getHash()) {
    $('.nav-tabs a[href=#' + History.getHash() + ']').tab('show');
  }

  // add state for tab changes
  $('.nav-tabs a').on('click', function (e) {
    History.pushState({
      tab: this.href
    }, 'FRIB traveler :: ' + this.text, this.href);
    // console.log(History.getHash());
  });

  // show the tab when back and forward
  window.onhashchange = function (newURL, oldURL) {
    // console.log(History.getHash());
    if (History.getHash()) {
      $('.nav-tabs a[href=#' + History.getHash() + ']').tab('show');
    }
  };


  $('#archive').click(function (e) {
    var selected = fnGetSelected(travelerTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Archive the following ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = travelerTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '">' + data.title + ' | ' + formatTravelerStatus(data.status) + '</div>');
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function (e) {
        archiveFromModal(true);
      });
    }
  });

  $('#clone').click(function (e) {
    var selected = fnGetSelected(travelerTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Clone the following ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = travelerTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '">' + data.title + ' | ' + formatTravelerStatus(data.status) + '</div>');
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function (e) {
        cloneFromModal();
      });
    }
  });

  $('#dearchive').click(function (e) {
    var selected = fnGetSelected(archivedTravelerTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('De-archive the following ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = archivedTravelerTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '">' + data.title + ' | ' + formatTravelerStatus(data.status) + '</div>');
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function (e) {
        archiveFromModal(false);
      });
    }
  });


  $('#reload').click(function (e) {
    travelerTable.fnReloadAjax();
    sharedTravelerTable.fnReloadAjax();
    groupSharedTravelerTable.fnReloadAjax();
    archivedTravelerTable.fnReloadAjax();
  });

  // binding events
  selectEvent();
  filterEvent();
});
