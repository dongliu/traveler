/* global ajax401, disableAjaxCache, prefix, updateAjaxURL,
 travelerGlobal, Holder, selectColumn, formLinkColumn, formConfigLinkColumn, titleColumn, tagsColumn, keysColumn, createdOnColumn,
 updatedOnColumn, updatedByColumn, sharedWithColumn, sharedGroupColumn,
 fnAddFilterFoot, sDomNoTools, createdByColumn, createdOnColumn,
 fnGetSelected, selectEvent, filterEvent, formShareLinkColumn,
 transferredOnColumn, ownerColumn, formStatusColumn, formTypeColumn,
 versionColumn, releasedFormLinkColumn, releasedFormStatusColumn,
 releasedFormVersionColumn, releasedByColumn, releasedOnColumn,
 transferFromModal, archivedByColumn, archivedOnColumn, formReviewLinkColumn */

function travelFromModal() {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  let number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function() {
    const that = this;
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
      })
      .fail(function(jqXHR) {
        $(that).prepend('<i class="icon-question"></i>');
        $(that).append(` : ${jqXHR.responseText}`);
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

function cloneFromModal(activeTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  let number = $('#modal .modal-body div.target').length;
  let base = activeTable.fnSettings().sAjaxSource.split('/')[1];
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
    const that = this;
    let success = false;
    $.ajax({
      url: `/${base}/${that.id}/clone`,
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
        $(that).append(` : ${jqXHR.responseText}`);
        $(that).addClass('text-error');
      })
      .always(function() {
        number = number - 1;
        if (number === 0 && success) {
          $('#return').prop('disabled', false);
        }
      });
  });
}

function showHash() {
  if (window.location.hash) {
    $(`.nav-tabs a[href=${window.location.hash}]`).tab('show');
  }
}

function formatItemUpdate(data) {
  return `<div class="target" id="${data._id}"><b>${data.title}</b> </div>`;
}

function cloneItem(data) {
  return `<div class="target" id="${data._id}">clone <b>${data.title}</b> <br> with new title: <input type="text" value="${data.title} clone"></div>`;
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  /* released form table starts */
  const releasedFormAoColumns = [
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
  const releasedFormTable = $('#released-form-table').dataTable({
    sAjaxSource: '/released-forms/json',
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
    aoColumns: releasedFormAoColumns,
    aaSorting: [[8, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#released-form-table', releasedFormAoColumns);
  /* released form table ends */

  /* archived released form table starts */
  const archivedReleasedFormAoColumns = [
    selectColumn,
    releasedFormLinkColumn,
    titleColumn,
    formTypeColumn,
    tagsColumn,
    releasedFormVersionColumn,
    archivedByColumn,
    archivedOnColumn,
  ];
  const archivedReleasedFormTable = $(
    '#archived-released-form-table'
  ).dataTable({
    sAjaxSource: '/archived-released-forms/json',
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
    aoColumns: archivedReleasedFormAoColumns,
    aaSorting: [[7, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot(
    '#archived-released-form-table',
    archivedReleasedFormAoColumns
  );
  /* archived released form table ends */

  // show the tab in hash
  showHash();

  // add state for tab changes
  $('.nav-tabs a').on('click', function() {
    window.history.pushState(null, `forms :: ${this.text}`, this.href);
  });

  // show the tab when back and forward
  window.onhashchange = function() {
    showHash();
  };

  $('#form-travel').click(function() {
    const activeTable = $('.tab-pane.active table').dataTable();
    const selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        `Create travelers from the following ${selected.length} forms? `
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        const data = activeTable.fnGetData(row);
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
    const activeTable = $('.tab-pane.active table').dataTable();
    const selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        `Transfer the following ${selected.length} forms? `
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        const data = activeTable.fnGetData(row);
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
    const activeTable = $('.tab-pane.active table').dataTable();
    const selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(`Clone the following ${selected.length} form(s)? `);
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        const data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(cloneItem(data));
      });
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        cloneFromModal(activeTable);
      });
    }
  });

  $('#reload').click(function() {
    releasedFormTable.fnReloadAjax();
    archivedReleasedFormTable.fnReloadAjax();
  });
  // binding events
  selectEvent();
  filterEvent();
});
