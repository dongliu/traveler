/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false, History: false */
/*global moment: false, Binder: false, ajax401: false, prefix: false, updateAjaxURL: false*/
/*global selectColumn: false, formLinkColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, sDom: false, sDomNoTools: false, oTableTools: false, fnSelectAll: false, fnDeselect: false, createdByColumn: false, createdOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, formShareLinkColumn: false, clonedByColumn: false, deadlineColumn: false, progressColumn: false, archivedOnColumn: false*/
function travelFromModal() {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
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
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR, status, error) {
      $(that).prepend('<i class="icon-question"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0) {
        $('#return').prop('disabled', false);
      }
    });
  });
}


function archiveFromModal(archive, activeTable, archivedFormTable, theOtherTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    var success = false;
    $.ajax({
      url: '/forms/' + that.id + '/archived',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        archived: archive
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR, status, error) {
      $(that).prepend('<i class="icon-question"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0 && success) {
        $('#return').prop('disabled', false);
        activeTable.fnReloadAjax();
        if (!!theOtherTable) {
          theOtherTable.fnReloadAjax();
        }
        archivedFormTable.fnReloadAjax();
      }
    });
  });
}

function transferFromModal(newOwnerName, formTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div.transfer').each(function (index) {
    var that = this;
    var success = false;
    $.ajax({
      url: '/forms/' + that.id + '/owner',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        name: newOwnerName
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR, status, error) {
      $(that).prepend('<i class="fa fa-exclamation"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0 && success) {
        $('#return').prop('disabled', false);
        formTable.fnReloadAjax();
      }
    });
  });
}

function cloneFromModal(formTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function (index) {
    var that = this;
    var success = false;
    $.ajax({
      url: '/forms/' + that.id + '/clone',
      type: 'POST'
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR, status, error) {
      $(that).prepend('<i class="icon-question"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0 && success) {
        $('#return').prop('disabled', false);
        formTable.fnReloadAjax();
      }
    });
  });
}

function showHash() {
  if (window.location.hash) {
    $('.nav-tabs a[href=' + window.location.hash + ']').tab('show');
  }
}

function formatItemUpdate(data) {
  return '<div id="' + data._id + '"><b>' + data.title + '</b>, created ' + moment(data.createdOn).fromNow() + ((!!data.updatedOn) ? (', updated ' + moment(data.updatedOn).fromNow()) : '') + '</div>';
}

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  /*form table starts*/
  var formAoColumns = [selectColumn, formLinkColumn, formShareLinkColumn, titleColumn, createdOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn, sharedGroupColumn];
  var formTable = $('#form-table').dataTable({
    sAjaxSource: '/forms/json',
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
    aoColumns: formAoColumns,
    aaSorting: [
      [5, 'desc'],
      [4, 'desc']
    ],
    sDom: sDomNoTools
  });
  fnAddFilterFoot('#form-table', formAoColumns);
  /*form table ends*/

  /*transferred form table starts*/
  var transferredFormAoColumns = [selectColumn, formLinkColumn, formShareLinkColumn, titleColumn, createdByColumn, createdOnColumn, transferredOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn, sharedGroupColumn];
  var transferredFormTable = $('#transferred-form-table').dataTable({
    sAjaxSource: '/transferredforms/json',
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
    aoColumns: transferredFormAoColumns,
    aaSorting: [
      [7, 'desc'],
      [6, 'desc']
    ],
    sDom: sDomNoTools
  });
  fnAddFilterFoot('#transferred-form-table', transferredFormAoColumns);
  /*form table ends*/

  /*shared form table starts*/
  var sharedFormAoColumns = [selectColumn, formLinkColumn, titleColumn, ownerColumn, updatedOnColumn, updatedByColumn, sharedWithColumn, sharedGroupColumn];
  var sharedFormTable = $('#shared-form-table').dataTable({
    sAjaxSource: '/sharedforms/json',
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
    aoColumns: sharedFormAoColumns,
    aaSorting: [
      [4, 'desc']
    ],
    sDom: sDomNoTools
  });
  fnAddFilterFoot('#shared-form-table', sharedFormAoColumns);
  /*shared form table ends*/

  /*group shared form table starts*/
  var groupSharedFormAoColumns = sharedFormAoColumns;
  var groupSharedFormTable = $('#group-shared-form-table').dataTable({
    sAjaxSource: '/groupsharedforms/json',
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
    aoColumns: groupSharedFormAoColumns,
    aaSorting: [
      [4, 'desc'],
      [5, 'desc']
    ],
    sDom: sDomNoTools
  });
  fnAddFilterFoot('#group-shared-form-table', groupSharedFormAoColumns);
  /*group shared form table ends*/

  /*archieved form table starts*/
  var archivedFormAoColumns = [selectColumn, formLinkColumn, titleColumn, archivedOnColumn, sharedWithColumn, sharedGroupColumn];
  var archivedFormTable = $('#archived-form-table').dataTable({
    sAjaxSource: '/archivedforms/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, "All"]
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
      sZeroRecords: 'No records to display.',
      sInfoEmpty: 'No entries to display.'
    },
    bDeferRender: true,
    aoColumns: archivedFormAoColumns,
    aaSorting: [
      [3, 'desc']
    ],
    sDom: sDomNoTools
  });
  fnAddFilterFoot('#archived-form-table', archivedFormAoColumns);
  /*archived form table ends*/

  // show the tab in hash
  showHash();

  // add state for tab changes
  $('.nav-tabs a').on('click', function (e) {
    window.history.pushState(null, 'FRIB forms :: ' + this.text, this.href);
  });

  // show the tab when back and forward
  window.onhashchange = function () {
    showHash();
  };

  $('#form-travel').click(function (e) {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Create travelers from the following ' + selected.length + ' forms? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function (e) {
        travelFromModal();
      });
    }
  });

  $('button.archive').click(function (e) {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Archive the following ' + selected.length + ' forms? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function (e) {
        archiveFromModal(true, activeTable, archivedFormTable);
      });
    }
  });

  $('button.transfer').click(function (e) {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Transfer the following ' + selected.length + ' forms? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-body').append('<h5>to the following user</h5>');
      $('#modal .modal-body').append('<form class="form-inline"><input id="username" type="text" placeholder="Last, First" name="name" class="input" required></form>');
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');

      travelerGlobal.usernames.initialize();
      $('#username').typeahead({
        minLength: 1,
        highlight: true,
        hint: true
      }, {
        name: 'usernames',
        display: 'displayName',
        limit: 20,
        source: travelerGlobal.usernames
      });
      $('#submit').click(function (e) {
        transferFromModal($('#username').val(), activeTable);
      });
    }
  });

  $('#clone').click(function (e) {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Clone the following ' + selected.length + ' forms? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function (e) {
        cloneFromModal(formTable);
      });
    }
  });

  $('#dearchive').click(function (e) {
    var selected = fnGetSelected(archivedFormTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('De-archive the following ' + selected.length + ' forms? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = archivedFormTable.fnGetData(row);
        $('#modal .modal-body').append('<div id="' + data._id + '"><b>' + data.title + '</b> created ' + moment(data.createdOn).fromNow() + ' archived ' + moment(data.archivedOn).fromNow() + '</div>');
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function (e) {
        archiveFromModal(false, formTable, archivedFormTable, transferredFormTable);
      });
    }
  });

  $('#reload').click(function (e) {
    formTable.fnReloadAjax();
    transferredFormTable.fnReloadAjax();
    sharedFormTable.fnReloadAjax();
    groupSharedFormTable.fnReloadAjax();
    archivedFormTable.fnReloadAjax();
  });
  // binding events
  selectEvent();
  filterEvent();
});
