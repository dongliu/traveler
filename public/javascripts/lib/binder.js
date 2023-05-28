/* global fnGetSelected, modalScroll, formatItemUpdate, selectColumn, binderLinkColumn, 
    titleColumn, tagsColumn, createdOnColumn, updatedOnColumn, fnAddFilterFoot, 
    sDomNoTNoR, selectEvent, filterEvent, moment */

export function formatItemUpdate(data) {
  return `<div class="target" id="${data._id}"><b>${
    data.title
  }</b>, created ${moment(data.createdOn).fromNow()}${
    data.updatedOn ? `, updated ${moment(data.updatedOn).fromNow()}` : ''
  }</div>`;
}

export function addItems(items, binders, type = 'traveler') {
  let number = $('#modal #progress div.target').length;
  $('#modal #progress div.target').each(function() {
    const that = this;
    let success = false;
    $.ajax({
      url: `/binders/${that.id}/`,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        ids: items,
        type,
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
        if (number === 0) {
          $('#return').prop('disabled', false);
        }
      });
  });
}

export function addModal(fromTable, type = 'traveler') {
  const selected = fnGetSelected(fromTable, 'row-selected');
  const items = [];
  if (selected.length === 0) {
    $('#modalLabel').html('Alert');
    $('#modal .modal-body').html('No item has been selected!');
    $('#modal .modal-footer').html(
      '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modal').modal('show');
    return;
  }
  $('#modalLabel').html(`Add the ${selected.length} ${type}(s)`);
  $('#modal .modal-body').empty();
  modalScroll(true);
  selected.forEach(function(row) {
    const data = fromTable.fnGetData(row);
    items.push(data._id);
    $('#modal .modal-body').append(formatItemUpdate(data));
  });
  $('#modal .modal-body').append(
    '<h3 id="select"> into following binders </h3>'
  );
  $('#modal .modal-body').append('<div id="progress"></div>');
  $('#modal .modal-body').append(
    '<table id="owned-binder-table" class="table table-bordered table-hover"></table>'
  );
  const binderAoColumns = [
    selectColumn,
    binderLinkColumn,
    titleColumn,
    tagsColumn,
    createdOnColumn,
    updatedOnColumn,
  ];
  fnAddFilterFoot('#owned-binder-table', binderAoColumns);
  const ownedBinderTable = $('#owned-binder-table').dataTable({
    sAjaxSource: '/ownedbinders/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 5,
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: binderAoColumns,
    aaSorting: [
      [4, 'desc'],
      [5, 'desc'],
    ],
    sDom: sDomNoTNoR,
  });
  selectEvent();
  filterEvent();
  $('#modal .modal-footer').html(
    '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
  $('#submit').click(function() {
    $('#submit').prop('disabled', true);
    $('#return').prop('disabled', true);
    const binders = [];
    const selectedRow = fnGetSelected(ownedBinderTable, 'row-selected');
    if (selectedRow.length === 0) {
      $('#modal #select')
        .text('Please select binder!')
        .addClass('text-warning');
      $('#submit').prop('disabled', false);
      $('#return').prop('disabled', false);
    } else {
      selectedRow.forEach(function(row) {
        const data = ownedBinderTable.fnGetData(row);
        binders.push(data._id);
        $('#modal #progress').append(formatItemUpdate(data));
      });
      addItems(items, binders);
    }
  });
}
