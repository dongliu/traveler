$(function() {
  var formAoColumns = [selectColumn, formLinkColumn, formTitleColumn, createdOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn];
  fnAddFilterFoot('#form-table', formAoColumns);
  var formTable = $('#form-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: formAoColumns,
    aaSorting: [
      [3, 'desc'],
      [4, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(formTable, '/forms/json');

  $('#form-select-all').click(function(e) {
    fnSelectAll(formTable, 'row-selected', 'select-row', true);
  });


  $('#form-select-none').click(function(e) {
    fnDeselect(formTable, 'row-selected', 'select-row');
  });

  var sharedFormAoColumns = [formLinkColumn, formTitleColumn, createdByColumn, createdOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn];
  var sharedFormTable = $('#shared-form-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: sharedFormAoColumns,
    aaSorting: [
      [3, 'desc'],
      [5, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(sharedFormTable, '/sharedforms/json');
  // binding events
  selectEvent();
  filterEvent();
});


// function initFormTable(formTable) {
//   $.ajax({
//     url: '/forms/json',
//     type: 'GET',
//     // contentType: 'application/json',
//     dataType: 'json'
//   }).done(function(json) {
//     formTable.fnClearTable();
//     formTable.fnAddData(json);
//     formTable.fnDraw();
//   }).fail(function(jqXHR, status, error) {
//     $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms.</div>');
//     $(window).scrollTop($('#message div:last-child').offset().top - 40);
//   }).always();
// }

function initTable(oTable, url) {
  $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json'
  }).done(function(json) {
    oTable.fnClearTable();
    oTable.fnAddData(json);
    oTable.fnDraw();
  }).fail(function(jqXHR, status, error) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms.</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();
}