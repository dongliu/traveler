/* global ajax401, disableAjaxCache, prefix, updateAjaxURL,
 travelerGlobal, Holder, selectColumn, formLinkColumn, formConfigLinkColumn, titleColumn, tagsColumn, keysColumn, createdOnColumn,
 updatedOnColumn, updatedByColumn, sharedWithColumn, sharedGroupColumn,
 fnAddFilterFoot, sDomNoTools, createdByColumn, createdOnColumn,
 fnGetSelected, selectEvent, filterEvent, formShareLinkColumn,
 transferredOnColumn, ownerColumn, formStatusColumn, formTypeColumn,
 versionColumn, releasedFormLinkColumn, releasedFormStatusColumn,
 releasedFormVersionColumn, releasedByColumn, releasedOnColumn,
 transferFromModal, archivedByColumn, archivedOnColumn */

function travelFromModal() {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function() {
    var that = this;
    $.ajax({
      url: '/travelers/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        form: this.id,
      }),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
        // success = true;
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
        }
      });
  });
}

function cloneFromModal(activeTable, formTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  var base = activeTable.fnSettings()['sAjaxSource'].split('/')[1];
  if (
    base === 'archivedforms' ||
    base === 'sharedforms' ||
    base === 'groupsharedforms'
  ) {
    base = 'forms';
  }

  if (base === 'archived-released-forms') {
    base = 'released-forms';
  }
  $('#modal .modal-body div.target').each(function() {
    var that = this;
    var success = false;
    $.ajax({
      url: '/' + base + '/' + that.id + '/clone',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        title: $('input', $(that)).val(),
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
  return (
    '<div class="target" id="' + data._id + '"><b>' + data.title + '</b> </div>'
  );
}

function cloneItem(data) {
  return (
    '<div class="target" id="' +
    data._id +
    '">clone <b>' +
    data.title +
    '</b> <br> with new title: <input type="text" value="' +
    data.title +
    ' clone"></div>'
  );
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  /*form table starts*/
  var formAoColumns = [
    selectColumn,
    formLinkColumn,
    formConfigLinkColumn,
    formShareLinkColumn,
    titleColumn,
    formStatusColumn,
    formTypeColumn,
    versionColumn,
    tagsColumn,
    keysColumn,
    createdOnColumn,
    updatedOnColumn,
    updatedByColumn,
    sharedWithColumn,
    sharedGroupColumn,
  ];
  var formTable = $('#form-table').dataTable({
    sAjaxSource: '/forms/json',
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
    aoColumns: formAoColumns,
    aaSorting: [
      [11, 'desc'],
      [10, 'desc'],
    ],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#form-table', formAoColumns);
  /*form table ends*/

  /*transferred form table starts*/
  var transferredFormAoColumns = [
    selectColumn,
    formLinkColumn,
    formShareLinkColumn,
    titleColumn,
    formStatusColumn,
    formTypeColumn,
    versionColumn,
    tagsColumn,
    keysColumn,
    createdByColumn,
    createdOnColumn,
    transferredOnColumn,
    updatedOnColumn,
    updatedByColumn,
    sharedWithColumn,
    sharedGroupColumn,
  ];
  var transferredFormTable = $('#transferred-form-table').dataTable({
    sAjaxSource: '/transferredforms/json',
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
    aoColumns: transferredFormAoColumns,
    aaSorting: [
      [11, 'desc'],
      [12, 'desc'],
    ],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#transferred-form-table', transferredFormAoColumns);
  /*transferred form table ends*/

  /*shared form table starts*/
  var sharedFormAoColumns = [
    selectColumn,
    formLinkColumn,
    titleColumn,
    formStatusColumn,
    formTypeColumn,
    versionColumn,
    tagsColumn,
    keysColumn,
    ownerColumn,
    updatedByColumn,
    updatedOnColumn,
    sharedWithColumn,
    sharedGroupColumn,
  ];
  var sharedFormTable = $('#shared-form-table').dataTable({
    sAjaxSource: '/sharedforms/json',
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
    aoColumns: sharedFormAoColumns,
    aaSorting: [[10, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#shared-form-table', sharedFormAoColumns);
  /*shared form table ends*/

  /*group shared form table starts*/
  var groupSharedFormAoColumns = sharedFormAoColumns;
  var groupSharedFormTable = $('#group-shared-form-table').dataTable({
    sAjaxSource: '/groupsharedforms/json',
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
    aoColumns: groupSharedFormAoColumns,
    aaSorting: [[9, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#group-shared-form-table', groupSharedFormAoColumns);
  /*group shared form table ends*/

  /*released form table starts*/
  var releasedFormAoColumns = [
    selectColumn,
    releasedFormLinkColumn,
    titleColumn,
    releasedFormStatusColumn,
    formTypeColumn,
    releasedFormVersionColumn,
    tagsColumn,
    releasedByColumn,
    releasedOnColumn,
  ];
  var releasedFormTable = $('#released-form-table').dataTable({
    sAjaxSource: '/released-forms/json',
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
    aoColumns: releasedFormAoColumns,
    aaSorting: [[8, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#released-form-table', releasedFormAoColumns);
  /*released form table ends*/

  /*archieved form table starts*/
  var archivedFormAoColumns = [
    selectColumn,
    formLinkColumn,
    titleColumn,
    formTypeColumn,
    versionColumn,
    tagsColumn,
    keysColumn,
    updatedByColumn,
    updatedOnColumn,
  ];
  var archivedFormTable = $('#archived-form-table').dataTable({
    sAjaxSource: '/archivedforms/json',
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
    aoColumns: archivedFormAoColumns,
    aaSorting: [[8, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#archived-form-table', archivedFormAoColumns);
  /*archived form table ends*/

  var archivedReleasedFormAoColumns = [
    selectColumn,
    releasedFormLinkColumn,
    titleColumn,
    formTypeColumn,
    tagsColumn,
    releasedFormVersionColumn,
    archivedByColumn,
    archivedOnColumn,
  ];
  var archivedReleasedFormTable = $('#archived-released-form-table').dataTable({
    sAjaxSource: '/archived-released-forms/json',
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
    aoColumns: archivedReleasedFormAoColumns,
    aaSorting: [[7, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot(
    '#archived-released-form-table',
    archivedReleasedFormAoColumns
  );

  // show the tab in hash
  showHash();

  // add state for tab changes
  $('.nav-tabs a').on('click', function() {
    window.history.pushState(null, 'forms :: ' + this.text, this.href);
  });

  // show the tab when back and forward
  window.onhashchange = function() {
    showHash();
  };

  $('#form-travel').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        'Create travelers from the following ' + selected.length + ' forms? '
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
        travelFromModal();
      });
    }
  });

  $('button.transfer').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        'Transfer the following ' + selected.length + ' forms? '
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
        transferFromModal($('#username').val(), 'forms', activeTable);
      });
    }
  });

  $('#clone').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        'Clone the following ' + selected.length + ' form(s)? '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(cloneItem(data));
      });
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        cloneFromModal(activeTable, formTable);
      });
    }
  });

  $('#reload').click(function() {
    formTable.fnReloadAjax();
    transferredFormTable.fnReloadAjax();
    sharedFormTable.fnReloadAjax();
    groupSharedFormTable.fnReloadAjax();
    releasedFormTable.fnReloadAjax();
    archivedFormTable.fnReloadAjax();
    archivedReleasedFormTable.fnReloadAjax();
  });
  // binding events
  selectEvent();
  filterEvent();
});
