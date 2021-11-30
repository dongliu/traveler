/* global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false, access: false, travelerGlobal: false, Holder */
/* global selectColumn: false, useridColumn: false, userNameNoLinkColumn: false, groupIdColumn: false, accessColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, sDomNoTools: false, groupNameColumn */

const path = window.location.pathname;

function initTable(list, oTable) {
  $.ajax({
    url: `${path + list}/json`,
    type: 'GET',
    dataType: 'json',
  })
    .done(function(json) {
      oTable.fnClearTable();
      oTable.fnAddData(json);
      oTable.fnDraw();
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for sharing information.</div>'
        );
      }
    });
}

function removeFromModal(list, cb) {
  const ids = [];
  $('#modal .modal-body .target').each(function() {
    ids.push(this.id);
  });
  $.ajax({
    url: `${path + list}/${ids.join()}`,
    type: 'DELETE',
    dataType: 'json',
  })
    .done(function(json) {
      json.forEach(function(id) {
        let item;
        if (list === 'users') {
          item = $(`#${id}`);
        } else if (list === 'groups') {
          item = $(`[title="${encodeURIComponent(id)}"]`);
        } else {
          return;
        }
        item.wrap('<del></del>');
        item.addClass('text-success');
      });
    })
    .fail(function(jqXHR) {
      $('.modal-body').append(`Error : ${jqXHR.responseText}`);
    })
    .always(function() {
      cb();
    });
}

function remove(list, oTable) {
  const selected = fnGetSelected(oTable, 'row-selected');
  if (selected.length) {
    $('#modalLabel').html(`Remove the following ${selected.length} ${list}? `);
    $('#modal .modal-body').empty();
    selected.forEach(function(row) {
      const data = oTable.fnGetData(row);
      if (list === 'users') {
        $('#modal .modal-body').append(
          `<div class="target" id="${data._id}">${data.username}</div>`
        );
      }
      if (list === 'groups') {
        $('#modal .modal-body').append(
          `<div class="target" id="${encodeURIComponent(
            data._id
          )}" title="${encodeURIComponent(data._id)}">${data.groupname}</div>`
        );
      }
    });
    $('#modal .modal-footer').html(
      '<button id="remove" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#remove').click(function(e) {
      e.preventDefault();
      $('#remove').prop('disabled', true);
      removeFromModal(list, function() {
        initTable(list, oTable);
      });
    });
    $('#modal').modal('show');
  } else {
    $('#modalLabel').html('Alert');
    $('#modal .modal-body').html('No item has been selected!');
    $('#modal .modal-footer').html(
      '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modal').modal('show');
  }
}

function modifyFromModal(list, cb) {
  let number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function() {
    const that = this;
    $.ajax({
      url: `${path + list}/${that.id}`,
      type: 'PUT',
      contentType: 'application/json',
      processData: false,
      data: JSON.stringify({
        access: $('#modal-access').prop('checked') ? 'write' : 'read',
      }),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
      })
      .fail(function(jqXHR) {
        $(that).append(` : ${jqXHR.responseText}`);
        $(that).addClass('text-error');
      })
      .always(function() {
        number = number - 1;
        if (number === 0) {
          if (cb) {
            cb();
          }
        }
      });
  });
}

function modify(list, oTable) {
  const selected = fnGetSelected(oTable, 'row-selected');
  if (selected.length) {
    $('#modalLabel').html(
      `Modify the following ${selected.length} ${list}' privilege? `
    );
    $('#modal .modal-body').empty();
    $('#modal .modal-body').append(
      '<form class="form-inline"><lable class="checkbox"><input id="modal-access" type="checkbox" name="access" value="write">write</lable></form>'
    );
    selected.forEach(function(row) {
      const data = oTable.fnGetData(row);
      if (list === 'users') {
        $('#modal .modal-body').append(
          `<div id="${data._id}">${data.username}</div>`
        );
      }

      if (list === 'groups') {
        $('#modal .modal-body').append(
          `<div id="${encodeURIComponent(data._id)}">${data.groupname}</div>`
        );
      }
    });
    $('#modal .modal-footer').html(
      '<button id="modify" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modify').click(function(e) {
      e.preventDefault();
      $('#modify').prop('disabled', true);
      if (list === 'users') {
        modifyFromModal('users', function() {
          initTable('users', oTable);
        });
      }

      if (list === 'groups') {
        modifyFromModal('groups', function() {
          initTable('groups', oTable);
        });
      }
    });
    $('#modal').modal('show');
  } else {
    $('#modalLabel').html('Alert');
    $('#modal .modal-body').html('No item has been selected!');
    $('#modal .modal-footer').html(
      '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modal').modal('show');
  }
}

function inArray(name, ao) {
  let i;
  for (i = 0; i < ao.length; i += 1) {
    if ((ao[i].username || ao[i]._id) === name) {
      return true;
    }
  }
  return false;
}

function addto(data, table, list) {
  if (!!data.name || !!data.id) {
    if (inArray(data.name || data.id, table.fnGetData())) {
      let { name } = data;
      if (list === 'groups') {
        name = data.id;
      }
      // show message
      $('#message').append(
        `<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button><strong>${name}</strong> is already in the ${list} share list. </div>`
      );
    } else {
      $.ajax({
        url: `${path + list}/`,
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        processData: false,
        success(res, status, jqXHR) {
          $('#message').append(
            `<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>${jqXHR.responseText}</div>`
          );
          initTable(list, table);
        },
        error(jqXHR) {
          if (jqXHR.status !== 401) {
            $('#message').append(
              `<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the ${list} share list : ${jqXHR.responseText}</div>`
            );
          }
        },
      });
    }
  } else {
    $('#message').append(
      `<div class="alert"><button class="close" data-dismiss="alert">x</button>${list} name is empty. </div>`
    );
  }
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  if (typeof access !== 'undefined') {
    $('select[name="public"]').val(access);
  }
  let initAccess = $('select[name="public"]').val();

  $('select[name="public"]').change(function() {
    if ($('select[name="public"]').val() !== initAccess) {
      $('#update').attr('disabled', false);
    } else {
      $('#update').attr('disabled', true);
    }
  });

  $('#update').click(function(e) {
    e.preventDefault();
    const value = $('select[name="public"]').val();
    if (initAccess === value) {
      $('#message').append(
        '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The setting is not changed.</div>'
      );
    } else {
      $.ajax({
        url: `${path}public`,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify({
          access: value,
        }),
        processData: false,
        success(res, status, jqXHR) {
          $('#message').append(
            `<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>${jqXHR.responseText}</div>`
          );
          initAccess = value;
          $('#update').attr('disabled', true);
        },
        error(jqXHR) {
          if (jqXHR.status !== 401) {
            $('#message').append(
              `<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the public access setting : ${jqXHR.responseText}</div>`
            );
          }
        },
      });
    }
  });

  if ($('#username').length) {
    travelerGlobal.usernames.initialize();
  }

  $('#username').typeahead(
    {
      minLength: 1,
      highlight: true,
      hint: true,
    },
    {
      name: 'usernames',
      display: 'displayName',
      limit: 20,
      source: travelerGlobal.usernames,
    }
  );

  $('#username').on('typeahead:select', function() {
    $('#add').attr('disabled', false);
  });

  if ($('#groupname').length) {
    travelerGlobal.groupnames.initialize();
  }

  $('#groupname').typeahead(
    {
      minLength: 1,
      highlight: true,
      hint: true,
    },
    {
      name: 'groupnames',
      displayKey: '_id',
      limit: 20,
      source: travelerGlobal.groupnames,
    }
  );

  $('#groupname').on('typeahead:select', function() {
    $('#addgroup').attr('disabled', false);
  });

  const shareAoColumns = [
    selectColumn,
    useridColumn,
    userNameNoLinkColumn,
    accessColumn,
  ];
  const shareTable = $('#share-table').dataTable({
    aaData: [],
    // 'bAutoWidth': false,
    aoColumns: shareAoColumns,
    fnDrawCallback() {
      Holder.run({
        images: 'img.user',
      });
    },
    aaSorting: [[1, 'desc']],
    sDom: sDomNoTools,
  });

  const groupShareAoColumns = [
    selectColumn,
    groupIdColumn,
    groupNameColumn,
    accessColumn,
  ];
  const groupShareTable = $('#groupshare-table').dataTable({
    aaData: [],
    // 'bAutoWidth': false,
    aoColumns: groupShareAoColumns,
    fnDrawCallback() {
      Holder.run({
        images: 'img.user',
      });
    },
    aaSorting: [[1, 'desc']],
    sDom: sDomNoTools,
  });

  selectEvent();
  filterEvent();

  $('#add').click(function(e) {
    e.preventDefault();
    const data = {};
    data.name = $('#username').val();
    data.access = $('#access').prop('checked') ? 'write' : 'read';
    addto(data, shareTable, 'users');
    // document.forms[0].reset();
    $('form[name="user"]')[0].reset();
  });

  $('#addgroup').click(function(e) {
    e.preventDefault();
    const data = {};
    data.id = $('#groupname')
      .val()
      .toLowerCase();
    data.access = $('#groupaccess').prop('checked') ? 'write' : 'read';
    addto(data, groupShareTable, 'groups');
    // document.forms[1].reset();
    $('form[name="group"]')[0].reset();
  });

  $('#share-remove').click(function() {
    remove('users', shareTable);
  });

  $('#groupshare-remove').click(function() {
    remove('groups', groupShareTable);
  });

  $('#share-modify').click(function() {
    modify('users', shareTable);
  });

  $('#groupshare-modify').click(function() {
    modify('groups', groupShareTable);
  });

  if ($('#username').length) {
    initTable('users', shareTable);
  }
  if ($('#groupname').length) {
    initTable('groups', groupShareTable);
  }
});
