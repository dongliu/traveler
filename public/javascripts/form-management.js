/*
global moment, ajax401, disableAjaxCache, prefix, updateAjaxURL, Holder,
selectColumn, formLinkColumn, formConfigLinkColumn, titleColumn, tagsColumn,
keysColumn, fnAddFilterFoot, sDomNoTools, reviewersColumn, firstReviewRequestedOnColumn,
fnGetSelected, selectEvent, filterEvent, formShareLinkColumn, formStatusColumn,
formTypeColumn, versionColumn, docNoColumn, releasedFormStatusColumn,
releasedFormVersionColumn, releasedByColumn, releasedOnColumn,
archivedByColumn, archivedOnColumn, releasedFormLinkColumn
*/

import { initTableIfExists } from './lib/table.js';

function cloneFromModal(activeTable, formTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  let number = $('#modal .modal-body div.target').length;
  let base = activeTable.fnSettings().sAjaxSource.split('/')[1];
  if (base === 'archivedforms' || base === 'closedforms') {
    base = 'forms';
  }

  $('#modal .modal-body div.target').each(function() {
    const that = this;
    let success = false;
    const title = $('input#title', $(that)).val();
    const documentNumber = $('input#docNo', $(that)).val();
    $.ajax({
      url: `/${base}/${that.id}/clone`,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        title,
        documentNumber,
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
        $('#submit').prop('disabled', false);
        $('#return').prop('disabled', false);

        number = number - 1;
        $('#submit').prop('disabled', false);
        $('#return').prop('disabled', false);

        if (number === 0 && success) {
          formTable.fnReloadAjax();
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
  return `<div class="target" id="${data._id}">clone <b>${data.title}</b> <br> with new title: <input type="text" id="title" value="${data.title} clone"><br> and document number: <input type="text" id="docNo"></div>`;
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  const tables = [];

  /* closed form table starts */
  const closedFormAoColumns = [
    selectColumn,
    formLinkColumn,
    titleColumn,
    formTypeColumn,
    docNoColumn,
    versionColumn,
    formStatusColumn,
    docNoColumn,
    versionColumn,
    tagsColumn,
    createdOnColumn,
    updatedByColumn,
    updatedOnColumn,
    sharedWithColumn,
  ];

  if (shareGroups) {
    closedFormAoColumns.push(sharedGroupColumn);
  }

  const closedFormTableConfig = {
    sAjaxSource: '/closedforms/json',
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
    aoColumns: closedFormAoColumns,
    aaSorting: [
      [9, 'desc'],
      [8, 'desc'],
    ],
    sDom: sDomNoTools,
  };
  initTableIfExists($('#closed-form-table'), closedFormTableConfig, tables);
  /* submitted form table ends */

  /* archieved form table starts */
  const archivedFormAoColumns = [
    selectColumn,
    formLinkColumn,
    titleColumn,
    docNoColumn,
    versionColumn,
    tagsColumn,
    updatedByColumn,
    updatedOnColumn,
  ];
  const archivedFormTableConfig = {
    sAjaxSource: '/archivedforms/json',
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
    aoColumns: archivedFormAoColumns,
    aaSorting: [[6, 'desc']],
    sDom: sDomNoTools,
  };
  initTableIfExists($('#archived-form-table'), archivedFormTableConfig, tables);
  /* archived form table ends */

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
      $('#submit').on('click', function() {
        cloneFromModal(activeTable, $('#form-table').dataTable());
      });
    }
  });

  $('#reload').on('click', function() {
    tables.forEach(function(table) {
      table.fnReloadAjax();
    });
  });
  // binding events
  selectEvent();
  filterEvent();
});
