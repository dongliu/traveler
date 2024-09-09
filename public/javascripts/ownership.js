/* eslint-disable import/extensions */
/* global ajax401: false, prefix: false, updateAjaxURL: false, disableAjaxCache:
false, travelerGlobal: false, Holder: false */
/* global selectColumn: false, titleColumn: false, createdOnColumn: false,
updatedOnColumn: false, filledByColumn: false, sharedWithColumn: false,
sharedGroupColumn: false, fnAddFilterFoot: false, sDomNoTools: false,
createdOnColumn: false, travelerConfigLinkColumn: false,
travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false,
deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent:
false, deadlineColumn: false, travelerProgressColumn: false, tagsColumn: false,
keysColumn: false, fnSelectAll: false, fnDeselect: false */

/* global transferFromModal, modalScroll */

// import * as AddBinder from './lib/binder.js';
import * as Modal from './lib/modal.js';

function noneSelectedModal() {
  $('#modalLabel').html('Alert');
  $('#modal .modal-body').html('No traveler has been selected!');
  $('#modal .modal-footer').html(
    '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
}

function showHash() {
  if (window.location.hash) {
    $(`.nav-tabs a[href=${window.location.hash}]`).tab('show');
  }
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  const userId = $('span.userid').text();
  const travelerAoColumns = [
    selectColumn,
    travelerConfigLinkColumn,
    travelerShareLinkColumn,
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
  fnAddFilterFoot('#traveler-table', travelerAoColumns);
  const travelerTable = $('#traveler-table').dataTable({
    sAjaxSource: `/users/${userId}/travelers/json`,
    sAjaxDataProp: '',
    fnDrawCallback() {
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
    aoColumns: travelerAoColumns,
    aaSorting: [
      [11, 'desc'],
      [14, 'desc'],
    ],
    sDom: sDomNoTools,
  });

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
  fnAddFilterFoot('#binder-table', binderAoColumns);
  const binderTable = $('#binder-table').dataTable({
    sAjaxSource: `/users/${userId}/binders/json`,
    sAjaxDataProp: '',
    fnDrawCallback() {
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
    aaSorting: [
      [10, 'desc'],
      [8, 'desc'],
    ],
    sDom: sDomNoTools,
  });

  // show the tab in hash when loaded
  showHash();

  // show the tab when back and forward
  window.onhashchange = function() {
    showHash();
  };

  $('button.select-all').click(function() {
    const activeTable = $('.tab-pane.active table').dataTable();
    fnSelectAll(activeTable, 'row-selected', 'select-row', true);
  });

  $('button.deselect-all').click(function() {
    const activeTable = $('.tab-pane.active table').dataTable();
    fnDeselect(activeTable, 'row-selected', 'select-row');
  });

  $('button.transfer').click(function() {
    const activeTable = $('.tab-pane.active table').dataTable();
    const selected = fnGetSelected(activeTable, 'row-selected');
    modalScroll(false);
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        `Transfer the following ${selected.length} travelers? `
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        const data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(Modal.formatItemUpdate(data));
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
        transferFromModal($('#username').val(), 'travelers', activeTable);
      });
    }
  });

  $('#reload').click(function() {
    travelerTable.fnReloadAjax();
  });
  // binding events
  selectEvent();
  filterEvent();
});
