/*global ajax401: false, prefix: false, updateAjaxURL: false, traveler: true, FormLoader: false, moment: false*/
/*global previewColumn: false, referenceFormLinkColumn: false, aliasColumn: false, activatedOnColumn: false, sDomClean: false, titleColumn: false, updatedOnColumn: false, formColumn: false, sDomPage: false, fnAddFilterFoot: false, filterEvent: false*/
/*eslint max-nested-callbacks: [2, 4]*/

function findById(a, id) {
  var i;
  for (i = 0; i < a.length; i += 1) {
    if (a[i]._id === id) {
      return a[i];
    }
  }
  return null;
}

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
    dataType: 'json',
    data: JSON.stringify(form),
    processData: false
  }).done(function (json) {
    $('#modal .modal-body').append('<div class="text-success">The selected form is active now.</div>');
    cb(json);
  }).fail(function (jqXHR) {
    $('#modal .modal-body').append('<div class="text-error">Something was wrong: ' + jqXHR.responseText + '</div>');
  });
}

function setActive(fid, cb) {
  $.ajax({
    url: './forms/active',
    type: 'PUT',
    contentType: 'application/json',
    dataType: 'json',
    data: JSON.stringify({
      formid: fid
    }),
    processData: false
  }).done(function (json) {
    $('#modal .modal-body').append('<div class="text-success">The selected form is active now.</div>');
    cb(json);
  }).fail(function (jqXHR) {
    $('#modal .modal-body').append('<div class="text-error">Something was wrong: ' + jqXHR.responseText + '</div>');
  });
}


function initUsedForms(traveler, activeTable, usedTable) {
  var form;
  if (traveler.forms.length === 1) {
    form = traveler.forms[0];
  } else {
    form = findById(traveler.forms, traveler.activeForm);
  }
  if (form) {
    var active = {
      activatedOn: form.activatedOn.length ? form.activatedOn : [traveler.createdOn],
      _id: form._id,
      reference: form.reference || traveler.referenceForm,
      alias: form.alias || 'not set yet'
    };
    activeTable.fnClearTable();
    activeTable.fnAddData(active);
  }
  var used = [];
  if (traveler.forms.length > 1) {
    traveler.forms.forEach(function (value) {
      if (value._id !== traveler.activeForm) {
        value.activatedOn = value.activatedOn.length ? value.activatedOn : [traveler.createdOn];
        value.reference = value.reference || traveler.referenceForm;
        value.alias = value.alias || 'not set yest';
        used.push(value);
      }
    });
  }
  usedTable.fnClearTable();
  usedTable.fnAddData(used);
  $('tr').removeClass('row-selected');
  $('#active-form tbody tr:first-child').addClass('row-selected');
}


$(function () {

  ajax401(prefix);

  updateAjaxURL(prefix);

  var activeColumns = [previewColumn, aliasColumn, activatedOnColumn, referenceFormLinkColumn];
  var activeTable = $('#active-form').dataTable({
    aaData: [],
    bAutoWidth: true,
    aoColumns: activeColumns,
    sDom: sDomClean
  });

  var usedColumns = activeColumns;

  fnAddFilterFoot('#used-forms', usedColumns);
  var usedTable = $('#used-forms').dataTable({
    aaData: [],
    bAutoWidth: true,
    aoColumns: usedColumns,
    sDom: sDomPage
  });

  initUsedForms(traveler, activeTable, usedTable);

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
  var form;
  if (traveler.forms.length === 1) {
    form = traveler.forms[0];
  } else {
    form = findById(traveler.forms, traveler.activeForm);
  }

  if (!form) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>HTTP request failed.</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }
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
      $('#modalLabel').html('Use the following used form');
      $('#modal .modal-body').html('<b>' + availableForms[fid].alias + '</b> last activated on ' + moment(availableForms[fid].activatedOn[availableForms[fid].activatedOn.length - 1]).format('YYYY-MM-DD HH:mm:ss'));
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function () {
        $('#submit').prop('disabled', true);
        // set the active form id
        setActive(fid, function (json) {
          traveler = json;
          initUsedForms(json, activeTable, usedTable);
        });
      });

    } else {
      $('#modalLabel').html('Use the following selected form');
      $('#modal .modal-body').html('<b>' + availableForms[fid].title + '</b> updated on ' + moment(availableForms[fid].updatedOn).format('YYYY-MM-DD HH:mm:ss'));
      $('#modal .modal-footer').html('<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>');
      $('#modal').modal('show');
      $('#submit').click(function () {
        // add the new form to the traveler forms list and set it active
        $('#submit').prop('disabled', true);
        newform = {
          html: availableForms[fid].html,
          _id: availableForms[fid]._id,
          title: availableForms[fid].title
        };
        addForm(newform, function (json) {
          traveler = json;
          initUsedForms(json, activeTable, usedTable);
        });
      });
    }
  });
});
