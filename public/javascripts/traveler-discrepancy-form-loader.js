/* global sDomClean, _, personColumn, dateColumn, Holder, traveler
 */
var DiscrepancyFormLoader = (function(parent, $, _) {
  var logs = [];
  var form = null;
  var tid = null;
  var table = null;
  var logTable = null;

  function discrepancyTableTitle(label, name, withKey = false) {
    var key = withKey
      ? '(' +
        (_.findKey(form.mapping, function(n) {
          return n === name;
        }) || '') +
        ')'
      : '';
    return label + key;
  }

  function logColumns(form) {
    var cols = [];
    cols.push({
      sTitle: 'sequence',
      mData: 'sequence',
    });
    _.mapKeys(form.labels, function(label, name) {
      cols.push({
        sTitle: discrepancyTableTitle(label, name),
        mData: name,
        sDefaultContent: '',
        bSortable: false,
      });
    });
    cols.push(
      personColumn('Documented by', 'inputBy'),
      dateColumn('On', 'inputOn')
    );
    return cols;
  }

  function renderLogs() {
    if (table === 'null' || form === 'null') {
      return;
    }
    if (logTable) {
      logTable.fnDestroy();
      $(table).empty();
      logTable = null;
    }
    var cols = logColumns(form);
    logTable = $(table).dataTable({
      aaData: [],
      bAutoWidth: true,
      // allow destroy and reinit
      bDestroy: true,
      fnDrawCallback: function() {
        Holder.run({
          images: 'img.user',
        });
      },
      aoColumns: cols,
      iDisplayLength: -1,
      sDom: sDomClean,
    });
  }

  function fileLink(log, record) {
    return (
      '<a target="_blank" href="./logs/' +
      log._id +
      '/records/' +
      record._id +
      '">' +
      record.value +
      '</a>'
    );
  }

  function retrieveLogs(cb) {
    if (tid === null) {
      return;
    }
    $.ajax({
      url: '/travelers/' + tid + '/logs/',
      type: 'GET',
      dataType: 'json',
    }).done(function(json) {
      logs = json;
      if (logs.length > 0) {
        var data = [];
        logs.forEach(function(l) {
          var logData = {};
          if (
            l.referenceForm &&
            l.referenceForm === traveler.referenceDiscrepancyForm &&
            l.inputBy &&
            l.inputOn &&
            l.records.length > 0
          ) {
            logData.inputBy = l.inputBy;
            logData.inputOn = l.inputOn;
            l.records.forEach(function(r) {
              if (r.name) {
                logData[r.name] = r.value;
              }
              if (r.file) {
                logData[r.name] = fileLink(l, r);
              }
            });
            data.push(logData);
          }
        });
        // sort logData
        data.sort(function(a, b) {
          return a.inputOn - b.inputOn;
        });
        data.forEach(function(d, i) {
          d.sequence = i + 1;
        });
        logTable.fnAddData(data);
      }
      if (cb) {
        cb();
      }
    });
  }

  /**
   * @param  {String} fid The form id to retrieve.
   * @return {undefined}
   */
  function retrieveForm(fid, cb) {
    $.ajax({
      url: '/forms/' + fid + '/json',
      type: 'GET',
      dataType: 'json',
      success: function(json) {
        form = json;
        if (cb) {
          cb(json);
        }
      },
    });
  }

  function setForm(f) {
    form = f;
  }

  function setTid(t) {
    tid = t;
  }

  function setLogTable(t) {
    table = t;
  }

  parent.renderLogs = renderLogs;
  parent.setLogTable = setLogTable;
  parent.retrieveLogs = retrieveLogs;
  parent.retrieveForm = retrieveForm;
  parent.setForm = setForm;
  parent.setTid = setTid;

  return parent;
})(DiscrepancyFormLoader || {}, jQuery, _);
