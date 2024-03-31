/* global fnGetSelected, moment */

export function formatItemUpdate(data) {
  return `<div class="target" id="${data._id}"><b>${
    data.title
  }</b>, created ${moment(data.createdOn).fromNow()}${
    data.updatedOn ? `, updated ${moment(data.updatedOn).fromNow()}` : ''
  }</div>`;
}

export function noneSelectedModal() {
  $('#modalLabel').html('Alert');
  $('#modal .modal-body').html('No traveler has been selected!');
  $('#modal .modal-footer').html(
    '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
}

export function modalScroll(scroll) {
  if (scroll) {
    $('#modal .modal-body').removeClass('modal-body-visible');
    $('#modal .modal-body').addClass('modal-body-scroll');
  } else {
    $('#modal .modal-body').removeClass('modal-body-scroll');
    $('#modal .modal-body').addClass('modal-body-visible');
  }
}

export function updateStatusFromModal(type, status, ...tables) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  let number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function() {
    const that = this;
    $.ajax({
      url: `/${type}s/${that.id}/status`,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        status,
      }),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
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
          tables.forEach(t => t.fnReloadAjax());
        }
      });
  });
}

export function archive(type, status, fromTable, updateTable) {
  const selected = fnGetSelected(fromTable, 'row-selected');
  modalScroll(false);
  if (selected.length === 0) {
    noneSelectedModal();
  } else {
    $('#modalLabel').html(
      `Archive the following ${selected.length} ${type}(s)? `
    );
    $('#modal .modal-body').empty();
    selected.forEach(function(row) {
      const data = fromTable.fnGetData(row);
      $('#modal .modal-body').append(formatItemUpdate(data));
    });
    $('#modal .modal-footer').html(
      '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modal').modal('show');
    $('#submit').click(function() {
      updateStatusFromModal(type, status, fromTable, updateTable);
    });
  }
}
