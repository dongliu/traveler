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
  const versionTable = $('#version-table').DataTable({
    ajax: {
      url: './versions/json',
      type: 'GET',
      dataSrc: function(response) {
        // filter all the changes with html and v change
        const htmlUpdates = [];
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
    if (that.prop('name') === 'left') {
      $('#left span.version').text(` version ${data._v}`);
      $('#left-form').html(data.html);
    } else {
      $('#right span.version').text(` version ${data._v}`);
      $('#right-form').html(data.html);
    }
  });

  $('#set').click(function() {
    // set the chosen version as the latest version
  });
});
