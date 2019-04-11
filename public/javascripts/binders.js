/*global clearInterval: false, clearTimeout: false, document: false, event: false,
frames: false, history: false, Image: false, location: false, name: false,
navigator: false, Option: false, parent: false, screen: false, setInterval:
false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false,
History: false*/
/*global ajax401: false, prefix: false, updateAjaxURL: false, disableAjaxCache:
false, moment: false, travelerGlobal: false*/
/*global selectColumn: false, titleColumn: false, createdOnColumn: false,
updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false,
sharedGroupColumn: false, fnAddFilterFoot: false, sDomNoTools: false,
createdByColumn: false, createdOnColumn: false, fnGetSelected: false,
selectEvent: false, filterEvent: false, clonedByColumn: false, archivedOnColumn:
false, binderConfigLinkColumn: false, binderShareLinkColumn: false,
binderLinkColumn: false, tagsColumn: false, binderWorkProgressColumn: false,
transferredOnColumn: false, ownerColumn: false*/
/*global archiveFromModal, transferFromModal, modalScroll, Holder*/

function formatItemUpdate(data) {
  return (
    '<div class="target" id="' +
    data._id +
    '"><b>' +
    data.title +
    '</b>, created ' +
    moment(data.createdOn).fromNow() +
    (data.updatedOn ? ', updated ' + moment(data.updatedOn).fromNow() : '') +
    '</div>'
  );
}

function showHash() {
  if (window.location.hash) {
    $('.nav-tabs a[href=' + window.location.hash + ']').tab('show');
  }
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  var binderAoColumns = [
    selectColumn,
    binderConfigLinkColumn,
    binderShareLinkColumn,
    binderLinkColumn,
    titleColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdOnColumn,
    updatedByColumn,
    updatedOnColumn,
    binderWorkProgressColumn,
  ];
  fnAddFilterFoot('#binder-table', binderAoColumns);
  var binderTable = $('#binder-table').dataTable({
    sAjaxSource: '/binders/json',
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
    aoColumns: binderAoColumns,
    aaSorting: [[10, 'desc'], [8, 'desc']],
    sDom: sDomNoTools,
  });

  var transferredBinderAoColumns = [
    selectColumn,
    binderConfigLinkColumn,
    binderShareLinkColumn,
    binderLinkColumn,
    titleColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdOnColumn,
    transferredOnColumn,
    updatedByColumn,
    updatedOnColumn,
    binderWorkProgressColumn,
  ];
  fnAddFilterFoot('#transferred-binder-table', transferredBinderAoColumns);
  var transferredBinderTable = $('#transferred-binder-table').dataTable({
    sAjaxSource: '/transferredbinders/json',
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
    aoColumns: transferredBinderAoColumns,
    aaSorting: [[11, 'desc'], [9, 'desc'], [8, 'desc']],
    sDom: sDomNoTools,
  });

  var sharedBinderAoColumns = [
    selectColumn,
    binderLinkColumn,
    titleColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    ownerColumn,
    createdOnColumn,
    updatedByColumn,
    updatedOnColumn,
    binderWorkProgressColumn,
  ];
  fnAddFilterFoot('#shared-binder-table', sharedBinderAoColumns);
  var sharedBinderTable = $('#shared-binder-table').dataTable({
    sAjaxSource: '/sharedbinders/json',
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
    aoColumns: sharedBinderAoColumns,
    aaSorting: [[9, 'desc'], [7, 'desc']],
    sDom: sDomNoTools,
  });

  var groupSharedBinderAoColumns = [
    selectColumn,
    binderLinkColumn,
    titleColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdByColumn,
    clonedByColumn,
    createdOnColumn,
    updatedByColumn,
    updatedOnColumn,
    binderWorkProgressColumn,
  ];
  fnAddFilterFoot('#group-shared-binder-table', groupSharedBinderAoColumns);
  var groupSharedBinderTable = $('#group-shared-binder-table').dataTable({
    sAjaxSource: '/groupsharedbinders/json',
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
    aoColumns: groupSharedBinderAoColumns,
    aaSorting: [[8, 'desc'], [10, 'desc']],
    sDom: sDomNoTools,
  });

  var archivedBinderAoColumns = [
    selectColumn,
    binderLinkColumn,
    titleColumn,
    archivedOnColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdOnColumn,
    updatedByColumn,
    updatedOnColumn,
    binderWorkProgressColumn,
  ];
  fnAddFilterFoot('#archived-binder-table', archivedBinderAoColumns);
  var archivedBinderTable = $('#archived-binder-table').dataTable({
    sAjaxSource: '/archivedbinders/json',
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
    aoColumns: archivedBinderAoColumns,
    aaSorting: [[3, 'desc'], [9, 'desc']],
    sDom: sDomNoTools,
  });

  // show the tab in hash when loaded
  showHash();

  // add state for tab changes
  $('.nav-tabs a').on('click', function() {
    if (
      !$(this)
        .parent()
        .hasClass('active')
    ) {
      window.history.pushState(null, 'Traveler :: ' + this.text, this.href);
    }
  });

  // show the tab when back and forward
  window.onhashchange = function() {
    showHash();
  };

  $('#reload').click(function() {
    binderTable.fnReloadAjax();
    transferredBinderTable.fnReloadAjax();
    sharedBinderTable.fnReloadAjax();
    groupSharedBinderTable.fnReloadAjax();
    archivedBinderTable.fnReloadAjax();
  });

  $('button.transfer').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    modalScroll(false);
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No work binder has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        'Transfer the following ' + selected.length + ' work binders? '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-body').append('<h5>to the following user</h5>');
      $('#modal .modal-body').append(
        '<form class="form-inline"><input id="username" type="text" placeholder="Last, First" name="name" class="input" required></form>'
      );
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');

      travelerGlobal.usernames.initialize();
      $('#username').typeahead(
        {
          minLength: 1,
          highlight: true,
          hint: true,
        },
        {
          name: 'usernames',
          display: 'displayName',
          limit: 20,
          source: travelerGlobal.usernames,
        }
      );
      $('#submit').click(function() {
        transferFromModal($('#username').val(), 'binders', activeTable);
      });
    }
  });

  $('button.archive').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    modalScroll(false);
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No work binder has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        'Archive the following ' + selected.length + ' work binders? '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        updateStatusFromModal(3, 'binders', activeTable, archivedBinderTable);
      });
    }
  });

  // binding events
  selectEvent();
  filterEvent();
});
