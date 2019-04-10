/*global ajax401: false, prefix: false, updateAjaxURL: false, traveler: true,
FormLoader: false, moment: false*/
/*global previewColumn: false, referenceFormLinkColumn: false, aliasColumn: false,
activatedOnColumn: false, sDomClean: false, titleColumn: false, updatedOnColumn:
false, formColumn: false, sDomPage: false, fnAddFilterFoot: false, filterEvent:
false*/
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

function addForm(form, cb) {
  $.ajax({
    url: './discrepency-forms/',
    type: 'POST',
    contentType: 'application/json',
    dataType: 'json',
    data: JSON.stringify(form),
    processData: false,
  })
    .done(function(json) {
      $('#modal .modal-body').append(
        '<div class="text-success">The selected form is active now.</div>'
      );
      cb(json);
    })
    .fail(function(jqXHR) {
      $('#modal .modal-body').append(
        '<div class="text-error">Something was wrong: ' +
          jqXHR.responseText +
          '</div>'
      );
    });
}

function setActive(fid, cb) {
  $.ajax({
    url: './discrepency-forms/active',
    type: 'PUT',
    contentType: 'application/json',
    dataType: 'json',
    data: JSON.stringify({
      formId: fid,
    }),
    processData: false,
  })
    .done(function(json) {
      $('#modal .modal-body').append(
        '<div class="text-success">The selected discrepency form is active now.</div>'
      );
      cb(json);
    })
    .fail(function(jqXHR) {
      $('#modal .modal-body').append(
        '<div class="text-error">Something was wrong: ' +
          jqXHR.responseText +
          '</div>'
      );
    });
}

function initUsedForms(traveler, activeTable, usedTable) {
  var form;
  if (traveler.discrepencyForms && traveler.discrepencyForms.length === 1) {
    form = traveler.discrepencyForms[0];
  } else {
    form = findById(traveler.discrepencyForms, traveler.activeDiscrepancyForm);
  }
  if (form) {
    var active = {
      activatedOn: form.activatedOn.length
        ? form.activatedOn
        : [traveler.createdOn],
      _id: form._id,
      reference: form.reference || traveler.referenceForm,
    };
    activeTable.fnClearTable();
    activeTable.fnAddData(active);
  }
  var used = [];
  if (traveler.discrepencyForms.length > 1) {
    traveler.discrepencyForms.forEach(function(value) {
      if (value._id !== traveler.activeDiscrepancyForm) {
        value.activatedOn = value.activatedOn.length
          ? value.activatedOn
          : [traveler.createdOn];
        value.reference = value.reference || traveler.referenceForm;
        used.push(value);
      }
    });
  }
  usedTable.fnClearTable();
  usedTable.fnAddData(used);
  $('tr').removeClass('row-selected');
  $('#active-form tbody tr:first-child').addClass('row-selected');
}

function loadForm(html) {
  FormLoader.setFormHTML(html);
  FormLoader.loadForm();
  FormLoader.bind();
  FormLoader.note();
}

$(function() {
  ajax401(prefix);

  updateAjaxURL(prefix);

  var activeColumns = [
    previewColumn,
    activatedOnColumn,
    versionColumn,
    referenceFormLinkColumn,
  ];
  var activeTable = $('#active-form').dataTable({
    aaData: [],
    bAutoWidth: true,
    aoColumns: activeColumns,
    sDom: sDomClean,
  });

  var usedColumns = activeColumns;

  fnAddFilterFoot('#used-forms', usedColumns);
  var usedTable = $('#used-forms').dataTable({
    aaData: [],
    bAutoWidth: true,
    aoColumns: usedColumns,
    sDom: sDomPage,
  });

  if (traveler.discrepencyForms && traveler.discrepencyForms.length > 0) {
    initUsedForms(traveler, activeTable, usedTable);
  }

  var availableColumns = [
    previewColumn,
    titleColumn,
    updatedOnColumn,
    formColumn,
  ];
  fnAddFilterFoot('#available-forms', availableColumns);
  var availableTable = $('#available-forms').dataTable({
    sAjaxSource: '/released-forms/discrepency/json',
    sAjaxDataProp: '',
    bProcessing: true,
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    aoColumns: availableColumns,
    aaSorting: [[2, 'desc']],
    sDom: sDomPage,
  });

  var discrepencyLegend =
    '<div id="discrepency-legend" class="control-group"><legend>Discrepancy</legend></div>';
  var travelerLegend =
    '<div id="traveler-legend" class="control-group"><legend>Traveler</legend></div>';

  FormLoader.setTravelerId(traveler._id);
  var form;
  if (traveler.forms.length === 1) {
    form = traveler.forms[0];
  } else {
    form = findById(traveler.forms, traveler.activeForm);
  }

  var discrepencyForm;
  if (traveler.activeDiscrepancyForm) {
    discrepencyForm = findById(
      traveler.discrepencyForms,
      traveler.activeDiscrepancyForm
    );
  }

  if (!form) {
    $('#message').append(
      '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>HTTP request failed.</div>'
    );
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  } else {
    let html = form.html;
    // discrepency on the top
    if (discrepencyForm) {
      html =
        discrepencyLegend + discrepencyForm.html + travelerLegend + form.html;
    }
    loadForm(html);
  }

  // local cache of available forms
  var availableForms = {};

  // add forms to available forms object
  traveler.forms.forEach(function(f) {
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
      FormLoader.retrieveForm(fid, function(json) {
        $('#form').fadeTo('slow', 1);
        availableForms[fid] = json;
        let html =
          discrepencyLegend +
          availableForms[fid].html +
          travelerLegend +
          form.html;
        loadForm(html);
      });
    } else {
      $('#form').fadeTo('slow', 1);
      let html =
        discrepencyLegend +
        availableForms[fid].html +
        travelerLegend +
        form.html;
      loadForm(availableForms[fid].html);
    }
  });

  $('#use').click(function() {
    var selected = $('.row-selected');
    var fid = $('a.preview', selected).prop('id');
    var tid = selected.closest('table').prop('id');
    var newform;
    if (tid === 'active-form') {
      $('#modalLabel').html('Alert');
      $('#modal .modal-body').html('The selected form is currently in use.');
      $('#modal .modal-footer').html(
        '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
    } else if (tid === 'used-forms') {
      $('#modalLabel').html('Use the following used form');
      $('#modal .modal-body').html(
        '<b>' +
          availableForms[fid].alias +
          '</b> last activated on ' +
          moment(
            availableForms[fid].activatedOn[
              availableForms[fid].activatedOn.length - 1
            ]
          ).format('YYYY-MM-DD HH:mm:ss')
      );
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        $('#submit').prop('disabled', true);
        // set the active form id
        setActive(fid, function(json) {
          traveler = json;
          initUsedForms(json, activeTable, usedTable);
        });
      });
    } else {
      $('#modalLabel').html('Use the following selected form');
      $('#modal .modal-body').html(
        '<b>' +
          availableForms[fid].title +
          '</b> updated on ' +
          moment(availableForms[fid].updatedOn).format('YYYY-MM-DD HH:mm:ss')
      );
      $('#modal .modal-footer').html(
        '<button id="submit" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
      );
      $('#modal').modal('show');
      $('#submit').click(function() {
        // add the new form to the traveler forms list and set it active
        $('#submit').prop('disabled', true);
        newform = {
          formId: availableForms[fid]._id,
        };
        addForm(newform, function(json) {
          traveler = json;
          initUsedForms(json, activeTable, usedTable);
        });
      });
    }
  });
});
