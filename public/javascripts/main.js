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
  initFormTable(formTable);


  // binding events
  selectEvent();
  filterEvent();
});


function initFormTable(formTable) {
  $.ajax({
    url: '/forms/json',
    type: 'GET',
    // contentType: 'application/json',
    dataType: 'json'
  }).done(function(json) {
    formTable.fnClearTable();
    formTable.fnAddData(json);
    formTable.fnDraw();
  }).fail(function(jqXHR, status, error) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms.</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();
}