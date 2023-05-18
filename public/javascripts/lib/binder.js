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

export function addTravelers(travelers, binders) {
  let number = binders.length;
  binders.forEach(function(p) {
    $.ajax({
      url: `/binders/${p}/`,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        travelerIds: travelers,
      }),
    }).always(function() {
      number -= 1;
      if (number === 0) {
        $('#return').prop('disabled', false);
      }
    });
  });
}

export function addModal(fromTable) {
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
  $('#modalLabel').html(`Add the ${selected.length} items? `);
  $('#modal .modal-body').empty();
  modalScroll(true);
  selected.forEach(function(row) {
    const data = fromTable.fnGetData(row);
    items.push(data._id);
    $('#modal .modal-body').append(formatItemUpdate(data));
  });
  $('#modal .modal-body').append(
    '<h3 id="select"> into selected binders </h3>'
  );
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
      });
      addTravelers(items, binders);
    }
  });
}
