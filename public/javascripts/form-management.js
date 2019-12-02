/*
global moment, ajax401, disableAjaxCache, prefix, updateAjaxURL, Holder,
selectColumn, formLinkColumn, formConfigLinkColumn, titleColumn, tagsColumn,
keysColumn, updatedOnColumn, updatedByColumn, fnAddFilterFoot, sDomNoTools,
fnGetSelected, selectEvent, filterEvent, formShareLinkColumn, formStatusColumn,
formTypeColumn, versionColumn, releasedFormStatusColumn,
releasedFormVersionColumn, releasedByColumn, releasedOnColumn,
archivedByColumn, archivedOnColumn, releasedFormLinkColumn
*/

function cloneFromModal(formTable) {
  $('#submit').prop('disabled', true);
  $('#return').prop('disabled', true);
  var number = $('#modal .modal-body div.target').length;
  $('#modal .modal-body div.target').each(function() {
    var that = this;
    var success = false;
    $.ajax({
      url: '/forms/' + that.id + '/clone',
      type: 'POST',
    })
      .done(function() {
        $(that).prepend('<i class="fa fa-check"></i>');
        $(that).addClass('text-success');
        success = true;
      })
      .fail(function(jqXHR) {
        $(that).prepend('<i class="icon-question"></i>');
        $(that).append(' : ' + jqXHR.responseText);
        $(that).addClass('text-error');
      })
      .always(function() {
        number = number - 1;
        if (number === 0 && success) {
          $('#return').prop('disabled', false);
          formTable.fnReloadAjax();
        }
      });
  });
}

function showHash() {
  if (window.location.hash) {
    $('.nav-tabs a[href=' + window.location.hash + ']').tab('show');
  }
}

function formatItemUpdate(data) {
  return (
    '<div class="target" id="' +
    data._id +
    '"><b>' +
    data.title +
    '</b>, created ' +
    moment(data.createdOn).fromNow() +
    (data.updatedOn ? ', updated ' + moment(data.updatedOn).fromNow() : '') +
    '</div>'
  );
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  var formAoColumns = [
    selectColumn,
    formLinkColumn,
    formConfigLinkColumn,
    formShareLinkColumn,
    titleColumn,
    formTypeColumn,
    versionColumn,
    formStatusColumn,
    tagsColumn,
    keysColumn,
    updatedByColumn,
    updatedOnColumn,
  ];
  var formTable = $('#submitted-form-table').dataTable({
    sAjaxSource: '/submitted-forms/json',
    sAjaxDataProp: '',
    fnDrawCallback: function() {
      Holder.run({
        images: 'img.user',
      });
    },
    bAutoWidth: false,
    bProcessing: true,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: formAoColumns,
    aaSorting: [[11, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#submitted-form-table', formAoColumns);

  var releasedFormAoColumns = [
    selectColumn,
    releasedFormLinkColumn,
    titleColumn,
    formTypeColumn,
    releasedFormStatusColumn,
    releasedFormVersionColumn,
    tagsColumn,
    releasedByColumn,
    releasedOnColumn,
  ];
  var releasedFormTable = $('#released-form-table').dataTable({
    sAjaxSource: '/released-forms/json',
    sAjaxDataProp: '',
    fnDrawCallback: function() {
      Holder.run({
        images: 'img.user',
      });
    },
    bAutoWidth: false,
    bProcessing: true,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: releasedFormAoColumns,
    aaSorting: [[8, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#released-form-table', releasedFormAoColumns);

  var archivedFormAoColumns = [
    selectColumn,
    formLinkColumn,
    titleColumn,
    formTypeColumn,
    tagsColumn,
    releasedFormStatusColumn,
    releasedFormVersionColumn,
    archivedByColumn,
    archivedOnColumn,
  ];
  var archivedFormTable = $('#archived-form-table').dataTable({
    sAjaxSource: '/archived-released-forms/json',
    sAjaxDataProp: '',
    fnDrawCallback: function() {
      Holder.run({
        images: 'img.user',
      });
    },
    bAutoWidth: false,
    bProcessing: true,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: archivedFormAoColumns,
    aaSorting: [[8, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#archived-form-table', archivedFormAoColumns);

  // show the tab in hash
  showHash();

  // add state for tab changes
  $('.nav-tabs a').on('click', function() {
    window.history.pushState(null, 'forms :: ' + this.text, this.href);
  });

  // show the tab when back and forward
  window.onhashchange = function() {
    showHash();
  };

  $('#clone').click(function() {
    var activeTable = $('.tab-pane.active table').dataTable();
    var selected = fnGetSelected(activeTable, 'row-selected');
    if (selected.length === 0) {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('No form has been selected!');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html(
        'Clone the following ' + selected.length + ' forms? '
      );
      $('#modal .modal-body').empty();
      selected.forEach(function(row) {
        var data = activeTable.fnGetData(row);
        $('#modal .modal-body').append(formatItemUpdate(data));
      });
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        cloneFromModal(formTable);
      });
    }
  });

  $('#reload').click(function() {
    formTable.fnReloadAjax();
    releasedFormTable.fnReloadAjax();
    archivedFormTable.fnReloadAjax();
  });
  // binding events
  selectEvent();
  filterEvent();
});
