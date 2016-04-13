/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false, History: false */
/*global moment: false, ajax401: false, prefix: false, updateAjaxURL: false, disableAjaxCache: false, travelerGlobal: false, Holder: false*/
/*global selectColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, manPowerColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, sDomNoTools: false, createdOnColumn: false, transferredOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, ownerColumn: false, deadlineColumn: false, travelerProgressColumn: false, archivedOnColumn: false, packageLinkColumn: false, tagsColumn: false, sDomNoTNoR: false*/

function formatItemUpdate(data) {
  return '<div class="target" id="' + data._id + '"><b>' + data.title + '</b>, created ' + moment(data.createdOn).fromNow() + (data.updatedOn ? ', updated ' + moment(data.updatedOn).fromNow() : '') + '</div>';
}

function archiveFromModal(archive, travelerTable, archivedTravelerTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function () {
    var that = this;
    var success = false;
    $.ajax({
      url: '/travelers/' + that.id + '/archived',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        archived: archive
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR) {
      $(that).prepend('<i class="icon-question"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0) {
        $('#return').prop('disabled', false);
        if (success) {
          travelerTable.fnReloadAjax();
          archivedTravelerTable.fnReloadAjax();
        }
      }
    });
  });
}

function transferFromModal(newOwnerName, table) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function () {
    var that = this;
    var success = false;
    $.ajax({
      url: '/travelers/' + that.id + '/owner',
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify({
        name: newOwnerName
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR) {
      $(that).prepend('<i class="fa fa-exclamation"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0 && success) {
        $('#return').prop('disabled', false);
        table.fnReloadAjax();
      }
    });
  });
}

function cloneFromModal(travelerTable, sharedTravelerTable, groupSharedTravelerTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function () {
    var that = this;
    var success = false;
    $.ajax({
      url: '/travelers/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        source: this.id
      })
    }).done(function () {
      $(that).prepend('<i class="fa fa-check"></i>');
      $(that).addClass('text-success');
      success = true;
    }).fail(function (jqXHR) {
      $(that).prepend('<i class="icon-question"></i>');
      $(that).append(' : ' + jqXHR.responseText);
      $(that).addClass('text-error');
    }).always(function () {
      number = number - 1;
      if (number === 0) {
        $('#return').prop('disabled', false);
        if (success) {
          travelerTable.fnReloadAjax();
          sharedTravelerTable.fnReloadAjax();
          groupSharedTravelerTable.fnReloadAjax();
        }
      }
    });
  });
}

function addTravelers(travelers, packages) {
  var number = packages.length;
  packages.forEach(function (p) {
    $.ajax({
      url: '/workingpackages/' + p + '/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        travelers: travelers
      })
    }).always(function () {
      number -= 1;
      if (number === 0) {
        $('#return').prop('disabled', false);
      }
    });
  });
}

function showHash() {
  if (window.location.hash) {
    $('.nav-tabs a[href=' + window.location.hash + ']').tab('show');
  }
}

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  var travelerAoColumns = [selectColumn, travelerConfigLinkColumn, travelerShareLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, createdOnColumn, deadlineColumn, manPowerColumn, updatedOnColumn, travelerProgressColumn];
  fnAddFilterFoot('#traveler-table', travelerAoColumns);
  var travelerTable = $('#traveler-table').dataTable({
    sAjaxSource: '/travelers/json',
    sAjaxDataProp: '',
    fnInitComplete: function () {
      Holder.run({
        images: 'img.user'
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: travelerAoColumns,
    aaSorting: [
      [9, 'desc'],
      [12, 'desc']
    ],
    sDom: sDomNoTools
  });

  /*transferred traveler table starts*/
  var transferredTravelerAoColumns = [selectColumn, travelerConfigLinkColumn, travelerShareLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, createdOnColumn, transferredOnColumn, deadlineColumn, manPowerColumn, updatedOnColumn, travelerProgressColumn];
  var transferredTravelerTable = $('#transferred-traveler-table').dataTable({
    sAjaxSource: '/transferredtravelers/json',
    sAjaxDataProp: '',
    fnInitComplete: function () {
      Holder.run({
        images: 'img.user'
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: transferredTravelerAoColumns,
    aaSorting: [
      [9, 'desc'],
      [10, 'desc'],
      [13, 'desc']
    ],
    sDom: sDomNoTools
  });
  fnAddFilterFoot('#transferred-traveler-table', transferredTravelerAoColumns);
  /*transferred traveler table ends*/

  var sharedTravelerAoColumns = [selectColumn, travelerConfigLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, ownerColumn, createdOnColumn, deadlineColumn, manPowerColumn, updatedOnColumn, travelerProgressColumn];
  fnAddFilterFoot('#shared-traveler-table', sharedTravelerAoColumns);
  var sharedTravelerTable = $('#shared-traveler-table').dataTable({
    sAjaxSource: '/sharedtravelers/json',
    sAjaxDataProp: '',
    fnInitComplete: function () {
      Holder.run({
        images: 'img.user'
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: sharedTravelerAoColumns,
    aaSorting: [
      [12, 'desc'],
      [9, 'desc']
    ],
    sDom: sDomNoTools
  });
  var groupSharedTravelerAoColumns = [selectColumn, travelerConfigLinkColumn, travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, ownerColumn, createdOnColumn, deadlineColumn, manPowerColumn, updatedOnColumn, travelerProgressColumn];
  fnAddFilterFoot('#group-shared-traveler-table', sharedTravelerAoColumns);
  var groupSharedTravelerTable = $('#group-shared-traveler-table').dataTable({
    sAjaxSource: '/groupsharedtravelers/json',
    sAjaxDataProp: '',
    fnInitComplete: function () {
      Holder.run({
        images: 'img.user'
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: groupSharedTravelerAoColumns,
    aaSorting: [
      [12, 'desc'],
      [9, 'desc']
    ],
    sDom: sDomNoTools
  });
  var archivedTravelerAoColumns = [selectColumn, travelerLinkColumn, titleColumn, archivedOnColumn, statusColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, createdOnColumn, deadlineColumn, manPowerColumn, updatedOnColumn, travelerProgressColumn];
  fnAddFilterFoot('#archived-traveler-table', archivedTravelerAoColumns);
  var archivedTravelerTable = $('#archived-traveler-table').dataTable({
    sAjaxSource: '/archivedtravelers/json',
    sAjaxDataProp: '',
    fnInitComplete: function () {
      Holder.run({
        images: 'img.user'
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: archivedTravelerAoColumns,
    aaSorting: [
      [3, 'desc'],
      [11, 'desc']
    ],
    sDom: sDomNoTools
  });

  // show the tab in hash when loaded
  showHash();

  // add state for tab changes
  $('.nav-tabs a').on('click', function () {
    if (!$(this).parent().hasClass('active')) {
      window.history.pushState(null, 'FRIB traveler :: ' + this.text, this.href);
    }
  });

  // show the tab when back and forward
  window.onhashchange = function () {
    showHash();
  };

  $('button.archive').click(function () {
    var selected = fnGetSelected(travelerTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Archive the following ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = travelerTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function () {
        archiveFromModal(true, travelerTable, archivedTravelerTable);
      });
    }
  });

  $('#clone').click(function () {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Clone the following ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function () {
        cloneFromModal(travelerTable, sharedTravelerTable, groupSharedTravelerTable);
      });
    }
  });

  $('#add-to-package').click(function () {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    var travelers = [];
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Add the ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        travelers.push(data._id);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-body').append('<h3 id="select"> into selected packages </h3>');
      $('#modal .modal-body').append('<table id="owned-package-table" class="table table-bordered table-hover"></table>');
      var packageAoColumns = [selectColumn, packageLinkColumn, titleColumn, tagsColumn, createdOnColumn, updatedOnColumn];
      fnAddFilterFoot('#owned-package-table', packageAoColumns);
      var ownedPackageTable = $('#owned-package-table').dataTable({
        sAjaxSource: '/ownedpackages/json',
        sAjaxDataProp: '',
        bAutoWidth: false,
        iDisplayLength: 5,
        oLanguage: {
          sLoadingRecords: 'Please wait - loading data from the server ...'
        },
        bDeferRender: true,
        aoColumns: packageAoColumns,
        aaSorting: [
          [4, 'desc'],
          [5, 'desc']
        ],
        sDom: sDomNoTNoR
      });
      selectEvent();
      filterEvent();
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function () {
        $('#submit').prop('disabled', true);
        $('#return').prop('disabled', true);
        var packages = [];
        var selectedRow = fnGetSelected(ownedPackageTable, 'row-selected');
        if (selectedRow.length === 0) {
          $('#modal #select').text('Please select package!').addClass('text-warning');
          $('#submit').prop('disabled', false);
          $('#return').prop('disabled', false);
        } else {
          selectedRow.forEach(function (row) {
            var data = ownedPackageTable.fnGetData(row);
            packages.push(data._id);
          });
          addTravelers(travelers, packages);
        }
      });
    }
  });

  $('button.transfer').click(function () {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Transfer the following ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-body').append('<h5>to the following user</h5>');
      $('#modal .modal-body').append('<form class="form-inline"><input id="username" type="text" placeholder="Last, First" name="name" class="input" required></form>');
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');

      travelerGlobal.usernames.initialize();
      $('#username').typeahead({
        minLength: 1,
        highlight: true,
        hint: true
      }, {
        name: 'usernames',
        display: 'displayName',
        limit: 20,
        source: travelerGlobal.usernames
      });
      $('#submit').click(function () {
        transferFromModal($('#username').val(), activeTable);
      });
    }
  });

  $('#dearchive').click(function () {
    var selected = fnGetSelected(archivedTravelerTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No traveler has been selected!');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('De-archive the following ' + selected.length + ' travelers? ');
      $('#modal .modal-body').empty();
      selected.forEach(function (row) {
        var data = archivedTravelerTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function () {
        archiveFromModal(false, travelerTable, archivedTravelerTable);
      });
    }
  });

  $('#reload').click(function () {
    travelerTable.fnReloadAjax();
    transferredTravelerTable.fnReloadAjax();
    sharedTravelerTable.fnReloadAjax();
    groupSharedTravelerTable.fnReloadAjax();
    archivedTravelerTable.fnReloadAjax();
  });
  // binding events
  selectEvent();
  filterEvent();
});
