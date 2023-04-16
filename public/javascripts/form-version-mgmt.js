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
  const versionTable = $('#version-table').dataTable({
    ajax: {
      url: './versions/json',
      type: 'GET',
      dataSrc: function(response) {
        // filter all the changes with html and v change
        const htmlUpdates = response.filter(update => {
          const changes = update.c;
          let count = 0;
          for (let i = 0; i < changes.length; i += 1) {
            if (changes[i].p === 'html' || changes[i].p === '_v') {
              count += 1;
              if (count === 2) {
                return true;
              }
            }
          }
          return false;
        });
        return htmlUpdates.map(h => {
          return {
            a: h.a,
            html: h.c.find(c => c.p === 'html').v,
            _v: h.c.find(c => c.p === '_v').v,
          };
        });
      },
    },
    columns: versionColumns,
    pageLength: -1,
    dom: Table.domI,
    sorting: [[2, 'desc']],
  });

  $('tbody').on('click', 'input.radio-row', function(e) {
    if (!$(this).prop('checked')) {
      // load this row in the target view
    }
  });

  $('#set').click(function() {
    // set the chosen version as the latest version
  });
});
