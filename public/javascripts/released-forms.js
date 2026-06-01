/* global ajax401, disableAjaxCache, prefix, updateAjaxURL,
 travelerGlobal, Holder, selectColumn, formLinkColumn, formConfigLinkColumn, titleColumn, tagsColumn, keysColumn, createdOnColumn,
 updatedOnColumn, updatedByColumn, sharedWithColumn, sharedGroupColumn,
 fnAddFilterFoot, sDomNoTools, createdByColumn, createdOnColumn,
 fnGetSelected, selectEvent, filterEvent, formShareLinkColumn,
 transferredOnColumn, ownerColumn, formStatusColumn, formTypeColumn,
 versionColumn, releasedFormLinkColumn, releasedFormStatusColumn,
 releasedFormVersionColumn, releasedByColumn, releasedOnColumn,
 transferFromModal, archivedByColumn, archivedOnColumn, formReviewLinkColumn */

function travelFromModal(formId, formTitle, copyNumber) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);

  const $body = $('#modal .modal-body');
  $body.empty();
  for (let i = 1; i <= copyNumber; i++) {
    $body.append(
      `<div id="copy-${i}" class="target">${formTitle}_${i} &nbsp;<span class="copy-status"><i class="fa fa-spinner fa-spin"></i></span></div>`
    );
  }

  let remaining = copyNumber;

  function oneDone() {
    remaining -= 1;
    if (remaining === 0) {
      $('#return').prop('disabled', false);
    }
  }

  for (let i = 1; i <= copyNumber; i++) {
    const travelerTitle = `${formTitle}_${i}`;
    const $row = $(`#copy-${i}`);

    $.ajax({
      url: '/travelers/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ form: formId }),
    })
      .done(function(resp) {
        const parts = resp.location.replace(/\/$/, '').split('/');
        const travelerId = parts[parts.length - 1];
        $.ajax({
          url: `/travelers/${travelerId}/config`,
          type: 'PUT',
          contentType: 'application/json',
          data: JSON.stringify({ title: travelerTitle }),
        })
          .done(function() {
            $row.find('.copy-status').html('<i class="fa fa-check"></i>');
            $row.addClass('text-success');
          })
          .fail(function() {
            $row.find('.copy-status').html('<i class="fa fa-check"></i> (rename failed)');
            $row.addClass('text-warning');
          })
          .always(oneDone);
      })
      .fail(function(jqXHR) {
        $row.find('.copy-status').html(`<i class="icon-question"></i> : ${jqXHR.responseText}`);
        $row.addClass('text-error');
        oneDone();
      });
  }
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
    } else if (selected.length > 1) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('Please select only one form to create travelers from.');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      const data = activeTable.fnGetData(selected[0]);
      $('#modalLabel').html('Create travelers');
      $('#modal .modal-body').html(
        `<div><b>${data.title}</b></div>` +
        '<div class="control-group" style="margin-top:10px;">' +
        '<label class="control-label" for="copy-number">Number of copies</label>' +
        '<div class="controls">' +
        '<input type="number" id="copy-number" value="1" min="1" max="20" style="width:60px;"/>' +
        '</div></div>'
      );
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button>' +
        '<button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        const copyNumber = Math.min(20, Math.max(1, parseInt($('#copy-number').val(), 10) || 1));
        travelFromModal(data._id, data.title, copyNumber);
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
