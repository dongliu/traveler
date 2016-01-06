/*global ajax401: false, prefix: false, updateAjaxURL: false, traveler: false*/
/*global previewColumn: false, referenceFormLinkColumn: false, aliasColumn: false, activatedOnColumn: false, sDomClean: false, titleColumn: false, updatedOnColumn: false, formColumn: false, sDomPage: false*/
$(function () {

  ajax401(prefix);

  updateAjaxURL(prefix);

  var activeColumns = [previewColumn, aliasColumn, activatedOnColumn, referenceFormLinkColumn];
  // fnAddFilterFoot('#active-form', activeColumns);
  var form = traveler.forms[traveler.activeForm];
  var active = {
    activatedOn: form.activatedOn.length ? form.activatedOn : [traveler.createdOn],
    _id: form._id,
    reference: form.reference || traveler.referenceForm,
    alias: form.alias || 'not set yet'
  };
  var activeTable = $('#active-form').dataTable({
    aaData: [active],
    aoColumns: activeColumns,
    // bAutoWidth: false,
    sDom: sDomClean
  });

  var usedColumns = activeColumns;
  var used = [];
  traveler.forms.forEach(function (value, index) {
    if (index !== traveler.activeForm) {
      used.push(value);
    }
  });

  var usedTable = $('#used-forms').dataTable({
    aaData: used,
    aoColumns: usedColumns,
    // bAutoWidth: false,
    sDom: sDomPage
  });

  var availableColumns = [previewColumn, titleColumn, updatedOnColumn, formColumn];
  var availableTable = $('#available-forms').dataTable({
    sAjaxSource: '/forms/json',
    sAjaxDataProp: '',
    // bAutoWidth: false,
    bProcessing: true,
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    aoColumns: availableColumns,
    aaSorting: [
      [2, 'desc']
    ],
    sDom: sDomPage
  });

  $('tbody').on('click', 'td', function (e) {
    if ($(e.target).closest('tr').hasClass('row-selected') && !$(e.target).is('a') && !$(e.target).is('i')) {
      $(e.target).closest('tr').removeClass('row-selected');
    } else {
      $('tr').removeClass('row-selected');
      $(e.target).closest('tr').addClass('row-selected');
    }
  });

});
