/*global ajax401: false, prefix: false, updateAjaxURL: false, moment: false*/

import * as Table from './lib/table1.10.js';

$(function() {
  ajax401(prefix);

  updateAjaxURL(prefix);

  const versionColumns = [
    Table.versionRadioColumn('L', 'left'),
    Table.versionRadioColumn('R', 'right'),
    Table.versionColumn,
    Table.longDateColumn('created', 'a'),
  ];

  let latest = 0;
  const htmlUpdates = [];
  const versionTable = $('#version-table').DataTable({
    ajax: {
      url: './versions/json',
      type: 'GET',
      dataSrc: function(response) {
        // filter all the changes with html and v change
        response.forEach(update => {
          const changes = update.c;
          const found = { a: update.a };
          for (let i = 0; i < changes.length; i += 1) {
            if (changes[i].p === 'html') {
              found.html = changes[i].v;
              continue;
            }
            if (changes[i].p === '_v') {
              found._v = changes[i].v;
              continue;
            }
          }
          if (found.html !== undefined) {
            htmlUpdates.push(found);
          }
        });
        latest = htmlUpdates?.[htmlUpdates.length - 1]?._v || latest;
        return htmlUpdates;
      },
    },
    columns: versionColumns,
    pageLength: -1,
    dom: Table.domI,
    sorting: [[2, 'desc']],
  });

  $('#version-table tbody').on('click', 'input.radio-row', function(e) {
    const that = $(this);
    const data = versionTable.row(that.parents('tr')).data();
    $(`#${that.prop('name')} span.version`).text(` version ${data._v}`);
    $(`#${that.prop('name')}-form`).html(data.html);
    if (data._v < latest) {
      $(`#${that.prop('name')} .btn.use`).prop('disabled', false);
      $(`#${that.prop('name')} .btn.use`).prop('_v', data._v);
    } else {
      $(`#${that.prop('name')} .btn.use`).prop('disabled', true);
    }
  });

  $('.btn.use').click(function() {
    // set the chosen version as the latest version
    const version = $(this).prop('_v');
    const html = htmlUpdates.find(u => u._v === version).html;
    $.ajax({
      url: './',
      type: 'PUT',
      async: true,
      data: JSON.stringify({ html }),
      contentType: 'application/json',
      processData: false,
    })
      .done(function(responseData, textStatus, request) {
        window.location.reload(true);
      })
      .fail(function() {
        $('#message').append(
          `<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>failed to set a new version</div>`
        );
      });
  });
});
