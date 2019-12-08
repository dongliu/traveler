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

  var memberColumns = [selectColumn, userIdColumn, fullNameNoLinkColumn];

  var memberTable = $('#members-table').dataTable({
    sAjaxSource: '/groups/' + group._id + '/members/json',
    sAjaxDataProp: '',
    /*fnInitComplete: function () {
            Holder.run({
                images: 'img.group',
            });
        },*/
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: memberColumns,
    aaSorting: [[2, 'asc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#members-table', memberColumns);

  selectEvent();
  filterEvent();

  $('#addusertogroup').click(function(e) {
    e.preventDefault();
    var that = this;
    var displayName = $('#username').val();
    $.ajax({
      url: '/groups/' + group._id + '/adduser/' + displayName,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({}),
    })
      .success(function(data, status, jqXHR) {
        $('#message').append(
          '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' +
            'User ' +
            displayName +
            ' has been added to this group.' +
            '</div>'
        );
        $(that).addClass('text-success');
        memberTable.fnReloadAjax();
      })
      .fail(function(jqXHR) {
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function() {});
  });

  $('#btnDisplayName').click(function(e) {
    e.preventDefault();
    var that = this;
    $.ajax({
      url: '/groups/' + group._id,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({ name: $('#displayName').val() }),
    })
      .success(function(data, status, jqXHR) {
        $('#message').append(
          '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>' +
            'Display Name updated to "' +
            $('#displayName').val() +
            '"' +
            '</div>'
        );
      })
      .fail(function(jqXHR) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>' +
            'Error: ' +
            jqXHR.responseText +
            '</div>'
        );
      });
  });
});
