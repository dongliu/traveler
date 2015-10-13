/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false, History: false */
/*global moment: false, Binder: false, ajax401: false, prefix: false, updateAjaxURL: false, disableAjaxCache: false*/
/*global selectColumn: false, formLinkColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, sDom: false, sDomNoTools: false, oTableTools: false, fnSelectAll: false, fnDeselect: false, createdByColumn: false, createdOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, formShareLinkColumn: false, clonedByColumn: false, deadlineColumn: false, progressColumn: false, archivedOnColumn: false*/

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


function showHash() {
  if (window.location.hash) {
    $('.nav-tabs a[href=' + window.location.hash + ']').tab('show');
  }
}

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  var packageAoColumns = [selectColumn, packageConfigLinkColumn, packageShareLinkColumn, packageLinkColumn, titleColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, clonedByColumn, createdOnColumn, updatedByColumn, updatedOnColumn, packageProgressColumn];
  fnAddFilterFoot('#package-table', packageAoColumns);
  var packageTable = $('#package-table').dataTable({
    sAjaxSource: '/workingpackages/json',
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
    aoColumns: packageAoColumns,
    aaSorting: [
      [9, 'desc'],
      [11, 'desc']
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
      [10, 50, 100, "All"]
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: transferredPackageAoColumns,
    aaSorting: [
      [9, 'desc'],
      [11, 'desc']
    ],
    sDom: sDomNoTools
  });


  var sharedPackageAoColumns = [selectColumn, packageLinkColumn, titleColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, createdByColumn, clonedByColumn, createdOnColumn, updatedByColumn, updatedOnColumn, packageProgressColumn];
  fnAddFilterFoot('#shared-package-table', sharedPackageAoColumns);
  var sharedPackageTable = $('#shared-package-table').dataTable({
    sAjaxSource: '/sharedpackages/json',
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
    aoColumns: sharedPackageAoColumns,
    aaSorting: [
      [8, 'desc'],
      [10, 'desc']
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
      [10, 50, 100, "All"]
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
      [10, 50, 100, "All"]
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
  $('.nav-tabs a').on('click', function (e) {
    if (!$(this).parent().hasClass('active')) {
      window.history.pushState(null, 'FRIB traveler :: ' + this.text, this.href);
    }
  });

  // show the tab when back and forward
  window.onhashchange = function () {
    showHash();
  };


  $('#reload').click(function (e) {
    packageTable.fnReloadAjax();
    sharedPackageTable.fnReloadAjax();
    groupSharedPackageTable.fnReloadAjax();
    archivedPackageTable.fnReloadAjax();
  });

  // binding events
  selectEvent();
  filterEvent();
});
