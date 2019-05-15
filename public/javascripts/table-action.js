function modalScroll(scroll) {
  if (scroll) {
    $('#modal .modal-body').removeClass('modal-body-visible');
    $('#modal .modal-body').addClass('modal-body-scroll');
  } else {
    $('#modal .modal-body').removeClass('modal-body-scroll');
    $('#modal .modal-body').addClass('modal-body-visible');
  }
}

function updateStatusFromModal(status, type, fromTable, toTable, otherTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function() {
    var that = this;
    $.ajax({
      url: '/' + type + '/' + that.id + '/status',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        status: status,
      }),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
      })
      .fail(function(jqXHR) {
        $(that).prepend('<i class="icon-question"></i>');
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function() {
        number = number - 1;
        if (number === 0) {
          $('#return').prop('disabled', false);
          fromTable.fnReloadAjax();
          toTable.fnReloadAjax();
          if (otherTable) {
            otherTable.fnReloadAjax();
          }
        }
      });
  });
}

function transferFromModal(newOwnerName, type, table) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function() {
    var that = this;
    $.ajax({
      url: '/' + type + '/' + that.id + '/owner',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        name: newOwnerName,
      }),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
      })
      .fail(function(jqXHR) {
        $(that).prepend('<i class="fa fa-exclamation"></i>');
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function() {
        number = number - 1;
        if (number === 0) {
          $('#return').prop('disabled', false);
          table.fnReloadAjax();
        }
      });
  });
}

$('button.reload').click(function() {
  var activeTable = $('.tab-pane.active table').dataTable();
  activeTable.fnReloadAjax();
});
