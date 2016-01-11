/*global ajax401: false, prefix: false, updateAjaxURL: false, traveler: false, FormLoader: false*/
/*global previewColumn: false, referenceFormLinkColumn: false, aliasColumn: false, activatedOnColumn: false, sDomClean: false, titleColumn: false, updatedOnColumn: false, formColumn: false, sDomPage: false*/

$(function () {

  ajax401(prefix);

  updateAjaxURL(prefix);

  var activeColumns = [previewColumn, aliasColumn, activatedOnColumn, referenceFormLinkColumn];
  // fnAddFilterFoot('#active-form', activeColumns);
  var form = traveler.forms[traveler.activeForm];
  var viewedFormId = form._id;
  var active = {
    activatedOn: form.activatedOn.length ? form.activatedOn : [traveler.createdOn],
    _id: form._id,
    reference: form.reference || traveler.referenceForm,
    alias: form.alias || 'not set yet'
  };
  var activeTable = $('#active-form').dataTable({
    aaData: [active],
    aoColumns: activeColumns,
    sDom: sDomClean
  });
  $('#active-form tbody tr:first-child').addClass('row-selected');

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
    sDom: sDomPage
  });

  var availableColumns = [previewColumn, titleColumn, updatedOnColumn, formColumn];
  var availableTable = $('#available-forms').dataTable({
    sAjaxSource: '/forms/json',
    sAjaxDataProp: '',
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

  FormLoader.setTravelerId(traveler._id);
  FormLoader.setFormHTML(form.html);
  FormLoader.loadForm();
  FormLoader.bind();
  FormLoader.note();

  $('tbody').on('click', 'a.preview', function preview() {
    var row = $(this).closest('tr');
    if (row.hasClass('row-selected')) {
      return;
    }

    $('tr').removeClass('row-selected');
    row.addClass('row-selected');

    var tableId = $(this).closest('table').prop('id');

    if (tableId === 'active-form' || tableId === 'used-forms') {
      // bind the form locally

      return;
    }

    if (tableId === 'available-forms') {
      // fetch the form and bind it

      return;
    }
  });

});
