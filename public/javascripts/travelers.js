/*global moment: false, ajax401: false, prefix: false, updateAjaxURL: false,
disableAjaxCache: false, travelerGlobal: false, Holder: false*/
/*global selectColumn: false, titleColumn: false, createdOnColumn: false,
updatedOnColumn: false, filledByColumn: false, sharedWithColumn: false,
sharedGroupColumn: false, fnAddFilterFoot: false, sDomNoTools: false,
createdOnColumn: false, transferredOnColumn: false, travelerConfigLinkColumn:
false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn:
false, deviceColumn: false, fnGetSelected: false, selectEvent: false,
filterEvent: false, ownerColumn: false, deadlineColumn: false,
travelerProgressColumn: false, archivedOnColumn: false, binderLinkColumn: false,
tagsColumn: false, sDomNoTNoR: false*/

/*global archiveFromModal, transferFromModal, modalScroll, docNoColumn,
travelerVersionColumn, fnSelectAll, fnDeselect, updateStatusFromModal */

import * as AddBinder from './lib/binder.js';
import * as Modal from './lib/modal.js';
import * as Table from './lib/table.js';

function noneSelectedModal() {
  $('#modalLabel').html('Alert');
  $('#modal .modal-body').html('No traveler has been selected!');
  $('#modal .modal-footer').html(
    '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
}

function cloneFromModal(tables) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function() {
    var that = this;
    var success = false;
    $.ajax({
      url: '/travelers/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        source: this.id,
      }),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
        success = true;
      })
      .fail(function(jqXHR) {
        $(that).prepend('<i class="icon-question"></i>');
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function() {
        number = number - 1;
        if (number === 0) {
          $('#return').prop('disabled', false);
          if (success) {
            tables.forEach(function(table) {
              table.fnReloadAjax();
            });
          }
        }
      });
  });
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
  var travelerAoColumns = [
    selectColumn,
    travelerConfigLinkColumn,
    travelerLinkColumn,
    titleColumn,
    docNoColumn,
    travelerVersionColumn,
    statusColumn,
    deviceColumn,
    tagsColumn,
    createdByColumn,
    createdOnColumn,
    filledByColumn,
    updatedOnColumn,
    travelerProgressColumn,
  ];
  const travelerTableConfig = {
    sAjaxSource: '/currenttravelers/json',
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
    aoColumns: travelerAoColumns,
    aaSorting: [],
    sDom: sDomNoTools,
  };
  Table.sortByColumn(travelerTableConfig, updatedOnColumn, 'desc');
  Table.initTableIfExists($('#traveler-table'), travelerTableConfig, tables);

  /*transferred traveler table starts*/
  var transferredTravelerAoColumns = [
    selectColumn,
    travelerConfigLinkColumn,
    travelerShareLinkColumn,
    travelerLinkColumn,
    titleColumn,
    docNoColumn,
    travelerVersionColumn,
    statusColumn,
    deviceColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdOnColumn,
    transferredOnColumn,
    // deadlineColumn,
    filledByColumn,
    updatedOnColumn,
    travelerProgressColumn,
  ];
  const transferredTravelerTableConfig = {
    sAjaxSource: '/transferredtravelers/json',
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
    aoColumns: transferredTravelerAoColumns,
    aaSorting: [],
    sDom: sDomNoTools,
  };
  Table.sortByColumn(transferredTravelerTableConfig, updatedOnColumn, 'desc');
  Table.initTableIfExists(
    $('#transferred-traveler-table'),
    transferredTravelerTableConfig,
    tables
  );

  /*transferred traveler table ends*/

  var sharedTravelerAoColumns = [
    selectColumn,
    travelerConfigLinkColumn,
    travelerLinkColumn,
    titleColumn,
    docNoColumn,
    travelerVersionColumn,
    statusColumn,
    deviceColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    ownerColumn,
    createdOnColumn,
    filledByColumn,
    updatedOnColumn,
    travelerProgressColumn,
  ];
  const sharedTravelerTableConfig = {
    sAjaxSource: '/sharedtravelers/json',
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
    aoColumns: sharedTravelerAoColumns,
    aaSorting: [],
    sDom: sDomNoTools,
  };
  Table.sortByColumn(sharedTravelerTableConfig, updatedOnColumn, 'desc');
  Table.initTableIfExists(
    $('#shared-traveler-table'),
    sharedTravelerTableConfig,
    tables
  );

  var groupSharedTravelerAoColumns = [
    selectColumn,
    travelerLinkColumn,
    titleColumn,
    docNoColumn,
    travelerVersionColumn,
    statusColumn,
    deviceColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
    ownerColumn,
    createdOnColumn,
    // deadlineColumn,
    filledByColumn,
    updatedOnColumn,
    travelerProgressColumn,
  ];
  const groupSharedTravelerTableConfig = {
    sAjaxSource: '/groupsharedtravelers/json',
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
    aoColumns: groupSharedTravelerAoColumns,
    aaSorting: [],
    sDom: sDomNoTools,
  };
  Table.sortByColumn(groupSharedTravelerTableConfig, updatedOnColumn, 'desc');
  Table.initTableIfExists(
    $('#group-shared-traveler-table'),
    groupSharedTravelerTableConfig,
    tables
  );

  var archivedTravelerAoColumns = [
    selectColumn,
    travelerLinkColumn,
    titleColumn,
    docNoColumn,
    travelerVersionColumn,
    archivedOnColumn,
    statusColumn,
    deviceColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdOnColumn,
    // deadlineColumn,
    filledByColumn,
    updatedOnColumn,
    travelerProgressColumn,
  ];
  const archivedTravelerTableConfig = {
    sAjaxSource: '/archivedtravelers/json',
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
    aoColumns: archivedTravelerAoColumns,
    aaSorting: [],
    sDom: sDomNoTools,
  };
  Table.sortByColumn(archivedTravelerTableConfig, updatedOnColumn, 'desc');
  Table.initTableIfExists(
    $('#archived-traveler-table'),
    archivedTravelerTableConfig,
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
      window.history.pushState(null, 'traveler :: ' + this.text, this.href);
    }
  });

  // show the tab when back and forward
  window.onhashchange = function() {
    showHash();
  };

  $('button.select-all').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    fnSelectAll(activeTable, 'row-selected', 'select-row', true);
  });

  $('button.deselect-all').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    fnDeselect(activeTable, 'row-selected', 'select-row');
  });

  $('button.archive').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    modalScroll(false);
    if (selected.length === 0) {
      noneSelectedModal();
    } else {
      $('#modalLabel').html(
        'Archive the following ' + selected.length + ' travelers? '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(Modal.formatItemUpdate(data));
      });
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        updateStatusFromModal(
          4,
          'travelers',
          activeTable
          // archivedTravelerTable
        );
      });
    }
  });

  $('#report').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
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

  $('#clone').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
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
        'Clone the following ' + selected.length + ' travelers? '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(Modal.formatItemUpdate(data));
      });
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        cloneFromModal(tables);
      });
    }
  });

  $('#add-to-binder').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    AddBinder.addModal(activeTable);
  });

  $('button.transfer').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
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
        'Transfer the following ' + selected.length + ' travelers? '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = activeTable.fnGetData(row);
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
    tables.forEach(function(table) {
      table.fnReloadAjax();
    });
  });
  // binding events
  selectEvent();
  filterEvent();
});
