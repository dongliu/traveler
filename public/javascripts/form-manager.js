/*global ajax401: false, prefix: false, updateAjaxURL: false, traveler: false, FormLoader: false*/
/*global previewColumn: false, referenceFormLinkColumn: false, aliasColumn: false, activatedOnColumn: false, sDomClean: false, titleColumn: false, updatedOnColumn: false, formColumn: false, sDomPage: false, fnAddFilterFoot: false, filterEvent: false*/

function setAlias(fid, alias, updateTd) {
  $.ajax({
    url: './forms/' + fid + '/alias',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      value: alias
    })
  }).done(function () {
    $('#modal .modal-body').append('<div class="text-success">The new alias was set.</div>');
    // update local table data
    updateTd();
  }).fail(function (jqXHR) {
    $('#modal .modal-body').append('<div class="text-error">Something was wrong: ' + jqXHR.responseText + '</div>');
  });
}

function addForm(form, cb) {
  $.ajax({
    url: './forms/',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(form),
    processData: false
  }).done(function (data) {
    cb(data);
  });
}


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
      value.activatedOn = value.activatedOn.length ? value.activatedOn : [traveler.createdOn];
      value.reference = value.reference || traveler.referenceForm;
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

  $('#set-alias').click(function () {
    var selected = $('.row-selected');
    var tid = selected.closest('table').prop('id');
    if (tid === 'available-forms') {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('Please select a form from either current form or used forms tables.');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else {
      $('#modalLabel').html('Set the alias to');
      $('#modal .modal-body').empty();
      $('#modal .modal-body').append('<div><input id="new-alias" type="text" placeholder="new alias"</div>');
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function () {
        $('#submit').prop('disabled', true);
        var fid = $('a.preview', selected).prop('id');
        var alias = $('#new-alias').val();
        setAlias(fid, alias, function updateTd() {
          var table = $('#' + tid).dataTable();
          var data = table.fnGetData(selected[0]);
          data.alias = alias;
          table.fnUpdate(data, table.fnGetPosition(selected[0]));
        });
      });
    }
  });

  $('#use').click(function () {
    var selected = $('.row-selected');
    var fid = $('a.preview', selected).prop('id');
    var tid = selected.closest('table').prop('id');
    var newform;
    if (tid === 'active-form') {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('The selected form is currently in use.');
      $('#modal .modal-footer').html('<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
    } else if (tid === 'used-forms') {
      // set the active form id
    } else {
      // add the new form to the traveler forms list and set it active
      newform = {
        html: availableForms[fid].html,
        _id: availableForms[fid]._id,
        title: availableForms[fid].title
      };
      // console.log(newform);
      addForm(newform, function (data) {
        console.log(data);
      });
    }
  });
});
