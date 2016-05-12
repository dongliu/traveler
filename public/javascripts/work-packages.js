/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false, History: false */
/*global ajax401: false, prefix: false, updateAjaxURL: false, disableAjaxCache: false, moment: false, travelerGlobal: false*/
/*global selectColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, sDomNoTools: false, createdByColumn: false, createdOnColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, clonedByColumn: false, archivedOnColumn: false, packageConfigLinkColumn: false, packageShareLinkColumn: false, packageLinkColumn: false, tagsColumn: false, packageProgressColumn: false, transferredOnColumn: false, ownerColumn: false*/


function formatItemUpdate(data) {
  return '<div class="target" id="' + data._id + '"><b>' + data.title + '</b>, created ' + moment(data.createdOn).fromNow() + (data.updatedOn ? ', updated ' + moment(data.updatedOn).fromNow() : '') + '</div>';
}

function modalScroll(scroll) {
  if (scroll) {
    $('#modal .modal-body').removeClass('modal-body-visible');
    $('#modal .modal-body').addClass('modal-body-scroll');
  } else {
    $('#modal .modal-body').removeClass('modal-body-scroll');
    $('#modal .modal-body').addClass('modal-body-visible');
  }
}

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

function transferFromModal(newOwnerName, table) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function () {
    var that = this;
    var success = false;
    $.ajax({
      url: '/workpackages/' + that.id + '/owner',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        name: newOwnerName
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR) {
      $(that).prepend('<i class="fa fa-exclamation"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0 && success) {
        $('#return').prop('disabled', false);
        table.fnReloadAjax();
      }
    });
  });
}


function showHash() {
  if (window.location.hash) {
    $('.nav-tabs a[href=' + window.location.hash + ']').tab('show');
  }
}

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  var packageAoColumns = [selectColumn, packageConfigLinkColumn, packageShareLinkColumn, packageLinkColumn, titleColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, createdOnColumn, updatedByColumn, updatedOnColumn, packageProgressColumn];
  fnAddFilterFoot('#package-table', packageAoColumns);
  var packageTable = $('#package-table').dataTable({
    sAjaxSource: '/workpackages/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: packageAoColumns,
    aaSorting: [
      [10, 'desc'],
      [8, 'desc']
    ],
    sDom: sDomNoTools
  });

  var transferredPackageAoColumns = [selectColumn, packageConfigLinkColumn, packageShareLinkColumn, packageLinkColumn, titleColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, createdOnColumn, transferredOnColumn, updatedByColumn, updatedOnColumn, packageProgressColumn];
  fnAddFilterFoot('#transferred-package-table', transferredPackageAoColumns);
  var transferredPackageTable = $('#transferred-package-table').dataTable({
    sAjaxSource: '/transferredpackages/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: transferredPackageAoColumns,
    aaSorting: [
      [11, 'desc'],
      [9, 'desc'],
      [8, 'desc']
    ],
    sDom: sDomNoTools
  });


  var sharedPackageAoColumns = [selectColumn, packageLinkColumn, titleColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, ownerColumn, createdOnColumn, updatedByColumn, updatedOnColumn, packageProgressColumn];
  fnAddFilterFoot('#shared-package-table', sharedPackageAoColumns);
  var sharedPackageTable = $('#shared-package-table').dataTable({
    sAjaxSource: '/sharedpackages/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: sharedPackageAoColumns,
    aaSorting: [
      [9, 'desc'],
      [7, 'desc']
    ],
    sDom: sDomNoTools
  });


  var groupSharedPackageAoColumns = [selectColumn, packageLinkColumn, titleColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, createdByColumn, clonedByColumn, createdOnColumn, updatedByColumn, updatedOnColumn, packageProgressColumn];
  fnAddFilterFoot('#group-shared-package-table', groupSharedPackageAoColumns);
  var groupSharedPackageTable = $('#group-shared-package-table').dataTable({
    sAjaxSource: '/groupsharedpackages/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: groupSharedPackageAoColumns,
    aaSorting: [
      [8, 'desc'],
      [10, 'desc']
    ],
    sDom: sDomNoTools
  });


  var archivedPackageAoColumns = [selectColumn, packageLinkColumn, titleColumn, archivedOnColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, createdOnColumn, updatedByColumn, updatedOnColumn, packageProgressColumn];
  fnAddFilterFoot('#archived-package-table', archivedPackageAoColumns);
  var archivedPackageTable = $('#archived-package-table').dataTable({
    sAjaxSource: '/archivedpackages/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: archivedPackageAoColumns,
    aaSorting: [
      [3, 'desc'],
      [9, 'desc']
    ],
    sDom: sDomNoTools
  });

  // show the tab in hash when loaded
  showHash();

  // add state for tab changes
  $('.nav-tabs a').on('click', function () {
    if (!$(this).parent().hasClass('active')) {
      window.history.pushState(null, 'FRIB traveler :: ' + this.text, this.href);
    }
  });

  // show the tab when back and forward
  window.onhashchange = function () {
    showHash();
  };


  $('#reload').click(function () {
    packageTable.fnReloadAjax();
    transferredPackageTable.fnReloadAjax();
    sharedPackageTable.fnReloadAjax();
    groupSharedPackageTable.fnReloadAjax();
    archivedPackageTable.fnReloadAjax();
  });

  $('button.transfer').click(function () {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    modalScroll(false);
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No work package has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Transfer the following ' + selected.length + ' work packages? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-body').append('<h5>to the following user</h5>');
      $('#modal .modal-body').append('<form class="form-inline"><input id="username" type="text" placeholder="Last, First" name="name" class="input" required></form>');
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
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
      $('#submit').click(function () {
        transferFromModal($('#username').val(), activeTable);
      });
    }
  });

  // binding events
  selectEvent();
  filterEvent();
});
