/*eslint max-nested-callbacks: [2, 4]*/

/*global sColumn, pColumn, vColumn, cColumn, travelerLinkColumn, aliasColumn, travelerProgressColumn, ownerColumn, deviceColumn, tagsColumn, manPowerColumn, sDomNoTools, fnAddFilterFoot, selectColumn, fnSelectAll, fnDeselect, fnGetSelected, selectEvent, filterEvent, keysColumn, workLinkColumn, titleColumn, moment*/
/*global ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix: false, Holder*/

function noneSelectedModal() {
  $('#modalLabel').html('Alert');
  $('#modal .modal-body').html('No traveler has been selected!');
  $('#modal .modal-footer').html(
    '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
}

$(function() {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  var workAoColumns = [
    selectColumn,
    workLinkColumn,
    titleColumn,
    ownerColumn,
    deviceColumn,
    tagsColumn,
    travelerProgressColumn,
  ];
  fnAddFilterFoot('#work-table', workAoColumns);
  var worksTable = $('#work-table').dataTable({
    bAutoWidth: false,
    bPaginate: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, -1],
      [10, 'All'],
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: workAoColumns,
    aaSorting: [
      [2, 'asc'],
    ],
    sDom: sDomNoTools,
  });

  $.ajax({
    url: './works/json',
    type: 'GET',
    dataType: 'json',
  })
    .done(function(data) {
      worksTable.fnAddData(data.works);
      worksTable.fnDraw();
      $('#value-progress').html(data.valueProgress);
      $('#traveler-progress').html(data.travelerProgress);
      $('#input-progress').html(data.inputProgress);
    })
    .always();

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });

  $('button.select-all').click(function() {
    var activeTable = worksTable;
    fnSelectAll(activeTable, 'row-selected', 'select-row', true);
  });

  $('button.deselect-all').click(function() {
    var activeTable = worksTable;
    fnDeselect(activeTable, 'row-selected', 'select-row');
  });

  $('#report').click(function() {
    var activeTable = worksTable;
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

  selectEvent();
  filterEvent();
});
