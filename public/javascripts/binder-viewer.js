/*eslint max-nested-callbacks: [2, 4]*/

/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false, moment */
/*global sColumn, pColumn, vColumn, cColumn, travelerLinkColumn, aliasColumn, travelerProgressColumn, ownerColumn, deviceColumn, tagsColumn, manPowerColumn, sDomNoTools, fnAddFilterFoot, selectColumn, fnSelectAll, fnDeselect, fnGetSelected, selectEvent, filterEvent, keysColumn*/
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
    travelerLinkColumn,
    sColumn,
    pColumn,
    vColumn,
    cColumn,
    aliasColumn,
    ownerColumn,
    deviceColumn,
    tagsColumn,
    keysColumn,
    manPowerColumn,
    travelerProgressColumn,
  ];
  fnAddFilterFoot('#work-table', workAoColumns);
  var worksTable = $('#work-table').dataTable({
    bAutoWidth: false,
    bPaginate: false,
    iDisplayLength: 10,
    aLengthMenu: [[10, -1], [10, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: workAoColumns,
    fnDrawCallback: function() {
      Holder.run({
        images: 'img.user',
      });
    },
    aaSorting: [[2, 'asc'], [3, 'asc']],
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

  $('#sort').click(function() {
    worksTable.fnSort([[1, 'asc'], [2, 'asc']]);
  });

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
