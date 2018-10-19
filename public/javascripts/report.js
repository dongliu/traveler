/*eslint max-nested-callbacks: [2, 4]*/

/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/* global deviceColumn, titleColumn, statusColumn, sDom, keyValueColumn, keyLabelColumn, oTableTools */
/* global ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix: false, _, moment */

/**
 * generate the control checkbox to show/hide the column
 * @param  {Object} col report table column defination
 * @return {String}     a checkbox input
 */
function colControl(col) {
  return '<label class="checkbox inline-checkbox"><input type="checkbox" checked data-toggle="' + (col.sTitle || col.mData || col) + '">' + (col.sTitle || col.mData || col) + '</label>';
}

/**
 * append the checkbox controls for the report table into target
 * @param  {String} target  Selector of the target
 * @param  {Array} columns defination of the columns to control
 * @return {undefined}
 */
function constructControl(target, columns) {
  columns.forEach(function (col) {
    $(target).append(colControl(col));
  });
}

// function rowArrayData(aoColumns, obj){
//   var out = [];
//   aoColumns.forEach(function(col) {
//     out.push(obj[col.mData]);
//   });
//   return out;
// }

function constructTable(table, travelers, colMap) {
  var systemColumns = [titleColumn, deviceColumn, statusColumn];
  var userColumns = [];
  var labelColIndex = [];
  systemColumns.forEach(function (col, index) {
    colMap[col.sTitle || col.mData] = [index];
  });
  var keys = [];
  var rows = [];
  var id;
  // var col;
  // get all user defined keys
  for (id in travelers) {
    keys = _.union(keys, _.keys(travelers[id].user_defined)).sort();
  }
  // add user defined keys to userColumns and colMap
  keys.forEach(function (key, index) {
    userColumns.push(keyLabelColumn(key));
    userColumns.push(keyValueColumn(key));
    colMap[key] = [systemColumns.length + 2 * index, systemColumns.length + 2 * index + 1];
    labelColIndex.push(systemColumns.length + 2 * index);
  });

  // get all the data
  for (id in travelers) {
    rows.push(travelers[id]);
  }

  constructControl('#system-keys', systemColumns);
  constructControl('#user-keys', keys);

  // draw the table
  table = $('#report-table').dataTable({
    aaData: rows,
    aoColumns: systemColumns.concat(userColumns),
    oTableTools: oTableTools,
    iDisplayLength: -1,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    sDom: sDom
  });

  return table;
}


$(function () {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  var colMap = {};

  var tid = $('#report-table').data('travelers');
  var rowN = tid.length;
  var travelers = {};
  var finishedT = 0;

  // var staticProperty = ['title', 'devices', 'status', 'id', 'tags'];

  $.each(tid, function (index, t) {
    $.ajax({
      // url: '/travelers/' + t + '/keyvalue/json',
      url: '/travelers/' + t + '/keylabelvalue/json',
      type: 'GET',
      dataType: 'json'
    }).done(function (data) {
      travelers[t] = data;
    }).always(function () {
      finishedT += 1;
      if (finishedT >= rowN) {
        var report = constructTable('#report-table', travelers, colMap);
        // register event handler
        $('.inline-checkbox input[type="checkbox"]').on('input', function () {
          var show = $(this).prop('checked');
          colMap[$(this).data('toggle')].forEach(function (c) {
            report.fnSetColumnVis(c, show);
          });
        });
      }
    });
  });

  $('input.group').on('input', function () {
    var value = $(this).prop('checked');
    var target = $(this).data('toggle');
    $(target + ' input[type="checkbox"]').prop('checked', value).trigger('input');
  });

  // $('input.span').on('input', function () {
  //   var value = $(this).prop('checked');
  //   var target = $(this).data('toggle');
  //   if (value) {
  //     $('span' + target).show();
  //   } else {
  //     $('span' + target).hide();
  //   }
  // });

  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });

});
