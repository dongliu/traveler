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

import * as AddBinder from './lib/binder.js';
import * as Modal from './lib/modal.js';
import { initTableIfExists, sortByColumn } from './lib/table.js';

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

  const tables = [];

  // Binder Table Configuration
  const binderAoColumns = [
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
  const binderTableConfig = {
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
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All'],
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: binderAoColumns,
    sDom: sDomNoTools,
  };
  sortByColumn(binderTableConfig, updatedOnColumn, 'desc');
  // sortByColumn(binderTableConfig, createdOnColumn, 'desc');
  const binderTable = initTableIfExists(
    $('#binder-table'),
    binderTableConfig,
    tables
  );

  // Transferred Binder Table Configuration
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
  const transferredBinderTableConfig = {
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
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All'],
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: transferredBinderAoColumns,
    sDom: sDomNoTools,
  };
  sortByColumn(transferredBinderTableConfig, updatedOnColumn, 'desc');
  // sortByColumn(transferredBinderTableConfig, updatedByColumn, 'desc');
  // sortByColumn(transferredBinderTableConfig, transferredOnColumn, 'desc');
  const transferredBinderTable = initTableIfExists(
    $('#transferred-binder-table'),
    transferredBinderTableConfig,
    tables
  );

  // Shared Binder Table Configuration
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
  const sharedBinderTableConfig = {
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
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All'],
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: sharedBinderAoColumns,
    sDom: sDomNoTools,
  };
  sortByColumn(sharedBinderTableConfig, updatedOnColumn, 'desc');
  // sortByColumn(sharedBinderTableConfig, createdOnColumn, 'desc');
  const sharedBinderTable = initTableIfExists(
    $('#shared-binder-table'),
    sharedBinderTableConfig,
    tables
  );

  // Group Shared Binder Table Configuration
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
  const groupSharedBinderTableConfig = {
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
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All'],
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: groupSharedBinderAoColumns,
    sDom: sDomNoTools,
  };
  // sortByColumn(groupSharedBinderTableConfig, createdOnColumn, 'desc');
  sortByColumn(groupSharedBinderTableConfig, updatedOnColumn, 'desc');
  const groupSharedBinderTable = initTableIfExists(
    $('#group-shared-binder-table'),
    groupSharedBinderTableConfig,
    tables
  );

  // Archived Binder Table Configuration
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
  const archivedBinderTableConfig = {
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
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All'],
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: archivedBinderAoColumns,
    sDom: sDomNoTools,
  };
  sortByColumn(archivedBinderTableConfig, archivedOnColumn, 'desc');
  // sortByColumn(archivedBinderTableConfig, updatedOnColumn, 'desc');
  const archivedBinderTable = initTableIfExists(
    $('#archived-binder-table'),
    archivedBinderTableConfig,
    tables
  );

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
    const activeTable = $('.tab-pane.active table').dataTable();
    Modal.archive('binder', 3, activeTable, archivedBinderTable);
  });

  $('button#dearchive').click(function() {
    const activeTable = $('.tab-pane.active table').dataTable();
    // dearchived binder always starts from a new status
    Modal.dearchive(
      'binder',
      0,
      activeTable,
      binderTable,
      transferredBinderTable
    );
  });

  $('#add-to-binder').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    AddBinder.addModal(activeTable, 'binder');
  });

  // binding events
  selectEvent();
  filterEvent();
});
