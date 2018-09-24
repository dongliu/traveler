/*eslint max-nested-callbacks: [2, 4]*/

/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/* global deviceColumn, titleColumn, statusColumn, sDom, keyValueColumn */
/* global ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix: false, _, moment */


$(function () {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  // var workAoColumns = [selectColumn, travelerLinkColumn, sColumn, pColumn, vColumn, cColumn, aliasColumn, ownerColumn, deviceColumn, tagsColumn, manPowerColumn, travelerProgressColumn];

  var tid = $('#report-table').data('travelers');
  var rowN = tid.length;
  var travelers = {};
  var travelerData = {};
  var keys = [];
  var columns = [titleColumn, deviceColumn, statusColumn];
  var rows = [];

  var finishedT = 0;
  var finishedD = 0;

  var reportTable = null;

  var staticProperty = ['title', 'devices', 'status'];

  function dataForName(name, data) {
    if (!name) {
      return null;
    }
    if (_.isEmpty(data)) {
      return null;
    }

    var found = data.filter(function (d) {
      return d.name === name;
    });
    // get the latest value from history
    if (found.length) {
      found.sort(function (a, b) {
        if (a.inputOn > b.inputOn) {
          return -1;
        }
        return 1;
      });
      return found[0].value;
    }
    return null;
  }

  function reportData(id) {
    var output = {};
    _.forEach(staticProperty, function (p) {
      output[p] = travelers[id][p];
    });
    _.forEach(keys, function (k) {
      output[k] = dataForName(travelers[id].mapping[k], travelerData[id]);
    });
    return output;
  }

  function constructTable() {
    if (finishedT < rowN || finishedD < rowN) {
      return;
    }
    var id;
    // get all user defined keys
    for (id in travelers) {
      keys = _.union(keys, _.keys(travelers[id].mapping));
    }
    // add user defined keys to columns
    _.forEach(keys, function (key) {
      columns.push(keyValueColumn(key));
    });
    // get all the data
    for (id in travelers) {
      rows.push(reportData(id));
    }

    // draw the table
    reportTable = $('#report-table').dataTable({
      aaData: rows,
      // 'bAutoWidth': false,
      aoColumns: columns,
      oTableTools: oTableTools,
      sDom: sDom
    });
  }

  $.each(tid, function (index, t) {
    $.ajax({
      url: '/travelers/' + t + '/json',
      type: 'GET',
      dataType: 'json'
    }).done(function (data) {
      travelers[t] = data;
    }).always(function () {
      finishedT += 1;
      if (finishedT >= rowN) {
        // console.log('travelers ready');
        constructTable();
      }
    });
  });

  $.each(tid, function (index, t) {
    $.ajax({
      url: '/travelers/' + t + '/data/',
      type: 'GET',
      dataType: 'json'
    }).done(function (data) {
      travelerData[t] = data;
    }).always(function () {
      finishedD += 1;
      if (finishedD >= rowN) {
        // console.log('data ready');
        constructTable();
      }
    });
  });

  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });

});
