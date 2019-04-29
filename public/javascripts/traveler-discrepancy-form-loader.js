/* global sDomClean, _, personColumn, dateColumn
 */
var DiscrepancyFormLoader = (function(parent, $, _) {
  var logs = [];
  var form = null;
  var tid = null;
  var table = null;
  var logTable = null;

  function logColumns(form) {
    var cols = [];
    _.mapKeys(form.labels, function(label, name) {
      cols.push({
        sTitle: label,
        mData: name,
        sDefaultContent: '',
      });
    });
    cols.push(
      personColumn('Inspected by', 'inputBy'),
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
      aoColumns: cols,
      sDom: sDomClean,
    });
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
          if (l.inputBy && l.inputOn && l.records.length > 0) {
            logData.inputBy = l.inputBy;
            logData.inputOn = l.inputOn;
            l.records.forEach(function(r) {
              if (r.name) {
                logData[r.name] = r.value;
              }
            });
            data.push(logData);
          }
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
