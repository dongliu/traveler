/*global selectColumn: false, groupIdColumn: false, displayNameColumn: false, membersColumn: false, lastVisitedOnColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, sDomNoTools: false, fnAddFilterFoot: false*/
/*global updateAjaxURL: false, prefix: false, Holder: false*/
/*global travelerGlobal: false*/

function inArray(name, ao) {
  var i;
  for (i = 0; i < ao.length; i += 1) {
    if (ao[i].name === name) {
      return true;
    }
  }
  return false;
}

function deleteFromModal(cb) {
  $('#remove').prop('disabled', true);
  var number = $('#modal .modal-body div').length;
  $('#modal .modal-body div').each(function() {
    var that = this;
    $.ajax({
      url: '/groups/' + that.id,
      type: 'DELETE',
      contentType: 'application/json',
      data: JSON.stringify({}),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
      })
      .fail(function(jqXHR) {
        $(that).append(' : ' + jqXHR.responseText);
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

function modifyFromModal(cb) {
  $('#remove').prop('disabled', true);
  var number = $('input.displayName').length;
  $('input.displayName').each(function() {
    var that = this;
    $.ajax({
      url: '/groups/' + that.id,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        name: that.value,
      }),
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
      })
      .fail(function(jqXHR) {
        $(that).append(' : ' + jqXHR.responseText);
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

$(function() {
  updateAjaxURL(prefix);

  travelerGlobal.usernames.initialize();

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

  $('#groupname').typeahead(
    {
      minLength: 1,
      highlight: true,
      hint: true,
    },
    {
      name: 'groupnames',
      display: 'displayName',
      limit: 20,
      source: travelerGlobal.groupnames,
    }
  );

  var groupColumns = [
    selectColumn,
    groupIdColumn,
    displayNameColumn,
    membersColumn,
  ];

  var groupTable = $('#groups-table').dataTable({
    sAjaxSource: '/groups/json?deleted=false',
    sAjaxDataProp: '',
    fnInitComplete: function() {
      Holder.run({
        images: 'img.group',
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: groupColumns,
    aaSorting: [[2, 'asc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#groups-table', groupColumns);

  selectEvent();
  filterEvent();

  $('#addGroup').click(function(e) {
    e.preventDefault();
    var name = $('#groupname').val();
    if (inArray(name, groupTable.fnGetData())) {
      //show message
      $('#message').append(
        '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The group named <strong>' +
          name +
          '</strong> is already in the group list. </div>'
      );
    } else {
      $.ajax({
        url: '/groups/',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
          name: name,
          manager: $('#manager').prop('checked'),
          admin: $('#admin').prop('checked'),
        }),
        success: function(data, status, jqXHR) {
          $('#message').append(
            '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' +
              jqXHR.responseText +
              '</div>'
          );
          groupTable.fnReloadAjax();
        },
        error: function(jqXHR) {
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the group list : ' +
              jqXHR.responseText +
              '</div>'
          );
        },
      });
    }
    document.forms[0].reset();
  });

  $('#group-delete').click(function() {
    var selected = fnGetSelected(groupTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html(
        'Delete the following ' +
          selected.length +
          ' groups? WARNING - This cannot be undone! '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = groupTable.fnGetData(row);
        $('#modal .modal-body').append(
          '<div id="' + data._id + '">' + data._id + ': ' + data.name + '</div>'
        );
      });
      $('#modal .modal-footer').html(
        '<button id="delete" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#delete').click(function(e) {
        e.preventDefault();
        $('#delete').prop('disabled', true);
        deleteFromModal(function() {
          groupTable.fnReloadAjax();
        });
      });
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No groups have been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    }
  });

  $('#group-modify').click(function() {
    var selected = fnGetSelected(groupTable, 'row-selected');
    if (selected.length) {
      $('#modalLabel').html(
        'Modify the following ' + selected.length + ' groups? '
      );
      $('#modal .modal-body').empty();
      $('#modal .modal-body').append(
        '<form id="modal-groups" class="form-inline">'
      );
      selected.forEach(function(row) {
        var data = groupTable.fnGetData(row);
        $('#modal .modal-body').append(
          '<label class="textbox" for="#' +
            data._id +
            '">' +
            data._id +
            '<input id="' +
            data._id +
            '" class="displayName" type="text" value="' +
            data.name +
            '"></label>'
        );
      });
      $('#modal .modal-body').append('</form>');
      $('#modal .modal-footer').html(
        '<button id="modify" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modify').click(function(e) {
        e.preventDefault();
        $('#modify').prop('disabled', true);
        modifyFromModal(function() {
          groupTable.fnReloadAjax();
        });
      });
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No groups have been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    }
  });
});
