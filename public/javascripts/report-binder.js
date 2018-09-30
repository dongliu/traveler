/*eslint max-nested-callbacks: [2, 4]*/

/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/* global deviceColumn, titleColumn, statusColumn, sDom, keyValueColumn, oTableTools */
/* global ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix: false, _, moment */


$(function () {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  var tid = $('#report-table').data('travelers');
  var rowN = tid.length;
  var travelers = {};
  var keys = [];
  var columns = [titleColumn, deviceColumn, statusColumn];
  var rows = [];

  var finishedT = 0;

  var reportTable = null;

  var staticProperty = ['title', 'devices', 'status', 'id', 'tags'];

  function constructTable(table) {
    var id;
    // get all user defined keys
    for (id in travelers) {
      keys = _.union(keys, _.keys(travelers[id])).sort();
    }
    // add user defined keys to columns
    _.forEach(keys, function (key) {
      if (staticProperty.indexOf(key) == -1) {
        columns.push(keyValueColumn(key));
      }
    });
    // get all the data
    for (id in travelers) {
      rows.push(travelers[id]);
    }

    // draw the table
    table = $('#report-table').dataTable({
      aaData: rows,
      aoColumns: columns,
      oTableTools: oTableTools,
      sDom: sDom
    });
  }

  $.each(tid, function (index, t) {
    $.ajax({
      url: '/travelers/' + t + '/keyvalue/json',
      type: 'GET',
      dataType: 'json'
    }).done(function (data) {
      travelers[t] = data;
    }).always(function () {
      finishedT += 1;
      if (finishedT >= rowN) {
        constructTable(reportTable);
      }
    });
  });

  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });

});
