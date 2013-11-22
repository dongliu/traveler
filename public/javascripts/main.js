$(function() {
  var formAoColumns = [selectColumn, formLinkColumn, titleColumn, createdOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn];
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

  var sharedFormAoColumns = [formLinkColumn, titleColumn, createdByColumn, createdOnColumn, updatedOnColumn, updatedByColumn, sharedWithColumn];
  fnAddFilterFoot('#shared-form-table', sharedFormAoColumns);
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

  var travelerAoColumns = [travalerConfigLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, createdOnColumn, updatedByColumn, updatedOnColumn];
  fnAddFilterFoot('#traveler-table', travelerAoColumns);
  var travelerTable = $('#traveler-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: travelerAoColumns,
    aaSorting: [
      [8, 'desc'],
      [6, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  initTable(travelerTable, '/travelers/json');


  $('#form-travel').click(function(e) {
    var selected = fnGetSelected(formTable, 'row-selected');
    if (selected.length == 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else if (selected.length > 1) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('Only one selected form is allowed for this action!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $.ajax({
        url: '/travelers/',
        method: 'POST',
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify({
          form: formTable.fnGetData(selected[0])._id
        })
      }).done(function(json) {
        $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>A new traveler is created at <a href="' + json.location + '">' + json.location + '</a></div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
        // initTable();
      }).fail(function(jqXHR, status, error) {
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot create new traveler</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }).always();
    }
  });


  // binding events
  selectEvent();
  filterEvent();
});

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

// function travel