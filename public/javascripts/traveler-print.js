/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, prefix: false, traveler: false*/

import { renderHistory } from './lib/traveler.js';

// temporary solution for the dirty forms
function cleanForm() {
  $('.control-group-buttons').remove();
}

function loadDiscrepancyLog(discrepancyForm) {
  DiscrepancyFormLoader.setForm(discrepancyForm);
  DiscrepancyFormLoader.renderLogs();
  DiscrepancyFormLoader.retrieveLogs();
}

// Draws one Section ({heading, rows} | {heading, table} | {heading, note})
// into `container`, entirely via safe DOM construction — every value from a
// Section is inserted with .text(), never .html() or a built HTML string,
// since this content is never escaped server-side (it is fetched as JSON).
function renderSection(container, section) {
  var $section = $('<div>').addClass('print-section');
  $section.append($('<h4>').text(section.heading));
  if (section.note) {
    $section.append($('<p>').addClass('text-muted').text(section.note));
  } else if (section.table) {
    var $table = $('<table>').addClass('table table-bordered table-condensed');
    var $thead = $('<thead>').appendTo($table);
    var $headRow = $('<tr>').appendTo($thead);
    section.table.head.forEach(function(label) {
      $headRow.append($('<th>').text(label));
    });
    var $tbody = $('<tbody>').appendTo($table);
    section.table.rows.forEach(function(row) {
      var $row = $('<tr>').appendTo($tbody);
      row.forEach(function(value) {
        $row.append($('<td>').text(value));
      });
    });
    $section.append($table);
  } else if (section.rows) {
    var $dl = $('<dl>').addClass('dl-horizontal');
    section.rows.forEach(function(pair) {
      $dl.append($('<dt>').text(pair[0]));
      $dl.append($('<dd>').text(pair[1]));
    });
    $section.append($dl);
  }
  container.append($section);
}

$(function() {
  ajax401(prefix);

  cleanForm();

  // load discrepancy table and data
  var discrepancyForm;
  if (traveler.activeDiscrepancyForm) {
    discrepancyForm = findById(
      traveler.discrepancyForms,
      traveler.activeDiscrepancyForm
    );
    DiscrepancyFormLoader.setLogTable('#discrepancy-log-table');
    DiscrepancyFormLoader.setTid(traveler._id);
    loadDiscrepancyLog(discrepancyForm);
  }

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });

  $('#location').attr('href', window.location);
  $('#localtime').text(Date());

  // NCR details and review records (spec 126), fetched client-side and
  // drawn with renderSection — #create-pdf stays disabled until both
  // resolve, so the single print action always produces a complete record.
  var ncrDetailsReady = false;
  var reviewRecordsReady = false;
  function enablePrintIfReady() {
    if (ncrDetailsReady && reviewRecordsReady) {
      $('#create-pdf').prop('disabled', false);
    }
  }

  $.ajax({
    url: '/travelers/' + traveler._id + '/ncr-print-details/',
    type: 'GET',
    dataType: 'json',
  }).done(function(entries) {
    var $container = $('#ncr-print-sections');
    if (entries.length === 0) {
      $container.append($('<p>').text('No NCRs linked to this traveler.'));
    } else {
      entries.forEach(function(entry) {
        $container.append($('<h4>').text(entry.ncrTitle));
        entry.sections.forEach(function(section) {
          renderSection($container, section);
        });
      });
    }
    ncrDetailsReady = true;
    enablePrintIfReady();
  });

  $.ajax({
    url: '/travelers/' + traveler._id + '/review-records/',
    type: 'GET',
    dataType: 'json',
  }).done(function(section) {
    renderSection($('#review-records'), section);
    reviewRecordsReady = true;
    enablePrintIfReady();
  });

  // update img
  $('#form')
    .find('img')
    .each(function() {
      var $this = $(this);
      if ($this.attr('name')) {
        if ($this.attr('src') === undefined) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if ($this.attr('src').indexOf('http') === 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if (prefix && $this.attr('src').indexOf(prefix) !== 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
      }
    });

  var binder = new Binder.FormBinder(document.forms[0]);
  renderHistory(binder);

  $('#form').on('click', 'a.notes-number', function(e) {
    e.preventDefault();
    var $input_notes = $(this)
      .closest('.controls')
      .find('.input-notes');
    if ($input_notes.is(':visible')) {
      $input_notes.hide();
    } else {
      $input_notes.show();
    }
  });

  $('#show-validation').click(function() {
    $('.validation').remove();
    $('#validation').html(
      '<h3>Summary</h3>' + validationMessage(document.getElementById('form'))
    );
    $('#validation').show();
  });

  $('#hide-validation').click(function() {
    $('#validation').hide();
    $('.validation').hide();
  });

  $('#show-notes').click(function() {
    $('.input-notes').show();
  });

  $('#hide-notes').click(function() {
    $('.input-notes').hide();
  });

  $('#show-details').click(function() {
    $('#details').show();
  });

  $('#hide-details').click(function() {
    $('#details').hide();
  });

  $('#create-pdf').click(function() {
    window.onbeforeprint = event => {
      $('#print-control').hide();
    };
    window.onafterprint = event => {
      $('#print-control').show();
    };
    window.print();
  });
});
