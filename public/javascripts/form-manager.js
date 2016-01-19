/*global ajax401: false, prefix: false, updateAjaxURL: false, traveler: false, FormLoader: false*/
/*global previewColumn: false, referenceFormLinkColumn: false, aliasColumn: false, activatedOnColumn: false, sDomClean: false, titleColumn: false, updatedOnColumn: false, formColumn: false, sDomPage: false, fnAddFilterFoot: false, filterEvent: false*/

$(function () {

  ajax401(prefix);

  updateAjaxURL(prefix);

  var activeColumns = [previewColumn, aliasColumn, activatedOnColumn, referenceFormLinkColumn];
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

  fnAddFilterFoot('#used-forms', usedColumns);
  var usedTable = $('#used-forms').dataTable({
    aaData: used,
    aoColumns: usedColumns,
    sDom: sDomPage
  });

  var availableColumns = [previewColumn, titleColumn, updatedOnColumn, formColumn];
  fnAddFilterFoot('#available-forms', availableColumns);
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

  function loadForm(html) {
    FormLoader.setFormHTML(html);
    FormLoader.loadForm();
    FormLoader.bind();
    FormLoader.note();
  }

  FormLoader.setTravelerId(traveler._id);
  loadForm(form.html);

  // local cache of available forms
  var availableForms = {};

  // add forms to available forms object
  traveler.forms.forEach(function (f) {
    availableForms[f._id] = f;
  });

  filterEvent();

  $('tbody').on('click', 'a.preview', function preview() {
    var row = $(this).closest('tr');
    if (row.hasClass('row-selected')) {
      return;
    }
    $('#form').fadeTo('slow', 0.5);
    $('tr').removeClass('row-selected');
    row.addClass('row-selected');

    var fid = this.id;

    if (!availableForms.hasOwnProperty(fid)) {
      FormLoader.retrieveForm(fid, function (json) {
        $('#form').fadeTo('slow', 1);
        availableForms[fid] = json;
        loadForm(availableForms[fid].html);
      });
    } else {
      $('#form').fadeTo('slow', 1);
      loadForm(availableForms[fid].html);
    }
  });

});
