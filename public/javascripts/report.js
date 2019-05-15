/*eslint max-nested-callbacks: [2, 5]*/

/* global deviceColumn, titleColumn, statusColumn, sDom, keyValueColumn,
 keyLabelColumn, oTableTools*/
/* global ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix:
 false, _, moment*/

/**
 * generate the control checkbox to show/hide the column
 * @param  {Object} col report table column defination
 * @return {String}     a checkbox input
 */
function colControl(col) {
  return (
    '<label class="checkbox inline-checkbox"><input type="checkbox" class="userkey" checked data-toggle="' +
    (col.sTitle || col.mData || col) +
    '">' +
    (col.sTitle || col.mData || col) +
    '</label>'
  );
}

/**
 * append the checkbox controls for the report table into target
 * @param  {String} target  Selector of the target
 * @param  {Array} columns defination of the columns to control
 * @return {undefined}
 */
function constructControl(target, columns) {
  columns.forEach(function(col) {
    $(target).append(colControl(col));
  });
}

function constructTable(table, travelers, colMap) {
  var systemColumns = [titleColumn, deviceColumn, statusColumn];
  var discrepancyColumns = [];
  var userColumns = [];
  var labelColIndex = [];
  systemColumns.forEach(function(col, index) {
    colMap[col.sTitle || col.mData] = [index];
  });
  var userKeys = [];
  var discrepancyKeys = [];
  var rows = [];
  var id;
  // get all user defined keys
  for (id in travelers) {
    userKeys = _.union(userKeys, _.keys(travelers[id].user_defined)).sort();
    discrepancyKeys = _.union(
      discrepancyKeys,
      _.keys(travelers[id].discrepancy)
    ).sort();
  }
  // add discrepancy keys to discrepancyColumns and colMap
  discrepancyKeys.forEach(function(key, index) {
    discrepancyColumns.push(keyValueColumn('discrepancy', key));
    colMap[key] = [systemColumns.length + index];
  });

  // add user defined keys to userColumns and colMap
  userKeys.forEach(function(key, index) {
    userColumns.push(keyLabelColumn(key));
    userColumns.push(keyValueColumn('user_defined', key));
    colMap[key] = [
      systemColumns.length + discrepancyColumns.length + 2 * index,
      systemColumns.length + discrepancyColumns.length + 2 * index + 1,
    ];
    labelColIndex.push(
      systemColumns.length + discrepancyColumns.length + 2 * index
    );
  });

  // get all the data
  for (id in travelers) {
    rows.push(travelers[id]);
  }

  constructControl('#system-keys', systemColumns);
  constructControl('#descrepancy-keys', discrepancyKeys);
  constructControl('#user-keys', userKeys);

  // draw the table
  var report = $(table).dataTable({
    aaData: rows,
    aoColumns: systemColumns.concat(discrepancyColumns).concat(userColumns),
    oTableTools: oTableTools,
    iDisplayLength: -1,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    sDom: sDom,
  });

  // register column event handler
  $('.inline-checkbox input.userkey').on('input', function() {
    var show = $(this).prop('checked');
    colMap[$(this).data('toggle')].forEach(function(c) {
      report.fnSetColumnVis(c, show);
    });
  });

  // register lable event hander
  $('.inline-checkbox input.labels').on('input', function() {
    var show = $(this).prop('checked');
    labelColIndex.forEach(function(c) {
      report.fnSetColumnVis(c, show);
    });
  });

  return report;
}

$(function() {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  var colMap = {};

  var tid = $('#report-table').data('travelers');
  var rowN = tid.length;
  var travelers = {};
  var finishedT = 0;

  $.each(tid, function(index, t) {
    $.ajax({
      url: '/travelers/' + t + '/keylabelvalue/json',
      type: 'GET',
      dataType: 'json',
    })
      .done(function(data) {
        travelers[t] = data;
      })
      .always(function() {
        finishedT += 1;
        if (finishedT >= rowN) {
          constructTable('#report-table', travelers, colMap);
        }
      });
  });

  $('input.group').on('input', function() {
    var value = $(this).prop('checked');
    var target = $(this).data('toggle');
    $(target + ' input[type="checkbox"]')
      .prop('checked', value)
      .trigger('input');
  });

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });
});
