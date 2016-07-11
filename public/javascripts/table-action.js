function modalScroll(scroll) {
  if (scroll) {
    $('#modal .modal-body').removeClass('modal-body-visible');
    $('#modal .modal-body').addClass('modal-body-scroll');
  } else {
    $('#modal .modal-body').removeClass('modal-body-scroll');
    $('#modal .modal-body').addClass('modal-body-visible');
  }
}

function archiveFromModal(archive, type, fromTable, toTable, otherTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function () {
    var that = this;
    $.ajax({
      url: '/' + type + '/' + that.id + '/archived',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        archived: archive
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
    }).fail(function (jqXHR) {
      $(that).prepend('<i class="icon-question"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-danger');
    }).always(function () {
      number = number - 1;
      if (number === 0) {
        $('#return').prop('disabled', false);
        fromTable.api().ajax.reload();
        toTable.api().ajax.reload();
        if (otherTable) {
          otherTable.api().ajax.reload();
        }
      }
    });
  });
}


function transferFromModal(newOwnerName, type, table) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function () {
    var that = this;
    $.ajax({
      url: '/' + type + '/' + that.id + '/owner',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        name: newOwnerName
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
    }).fail(function (jqXHR) {
      $(that).prepend('<i class="fa fa-exclamation"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-danger');
    }).always(function () {
      number = number - 1;
      if (number === 0) {
        $('#return').prop('disabled', false);
        table.api().ajax.reload();
      }
    });
  });
}

$('button.reload').click(function () {
  var activeTable = $('.tab-pane.active table').dataTable();
  activeTable.api().ajax.reload();
});
