/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, prefix: false*/

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
