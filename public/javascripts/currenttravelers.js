/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false, jsonPath: false, device: false, prefix: false, ajax401: false*/
/*global selectColumn: false, formLinkColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, fnAddFilterFoot: false, sDom: false, oTableTools: false, fnSelectAll: false, fnDeselect: false, createdByColumn: false, createdOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, deadlineColumn: false, progressColumn: false*/

function addData(oTable, url) {
  $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json',
  })
    .done(function(json) {
      oTable.fnAddData(json);
      oTable.fnDraw();
    })
    .fail(function(jqXHR, status, error) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms and travelers.</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}

var legacyAssignedUrl;
var legacyTravelerApiUrl;
var legacyDevicesUrl;
var searchLegacy = false;

var template = {
  title: {
    path: '$.TravelerNumber',
    defaultValue: 'unknown',
  },
  devices: {
    path: '$.Device',
    transform: function(data) {
      return [data];
    },
  },
  createdBy: {
    path: '$.Creator',
  },
  createdOn: {
    path: '$.AssignedOn',
  },
  status: {
    path: '$.Completed',
    transform: function(data) {
      return data ? 2 : 1;
    },
    defaultValue: -1,
  },
  url: {
    path: '$.ID',
    transform: function(data) {
      return externalUrl + data;
    },
  },
};

function transform(json, template) {
  var prop,
    output = {},
    valueFromPath;
  for (prop in template) {
    if (template.hasOwnProperty(prop)) {
      valueFromPath = jsonPath.eval(json, template[prop].path);
      if (valueFromPath.length === 1) {
        if (typeof template[prop].transform === 'function') {
          output[prop] = template[prop].transform(valueFromPath[0]);
        } else {
          output[prop] = valueFromPath[0];
        }
      } else {
        if (template[prop].hasOwnProperty('defaultValue')) {
          output[prop] = template[prop].defaultValue;
        } else {
          output[prop] = null;
        }
      }
    }
  }
  return output;
}

function addExternalData(oTable, url) {
  $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json',
  })
    .done(function(json) {
      var transformed = [];
      var i,
        size = json.length;
      for (i = 0; i < size; i += 1) {
        transformed[i] = transform(json[i], template);
      }
      oTable.fnAddData(transformed);
      oTable.fnDraw();
    })
    .fail(function(jqXHR, status, error) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms and travelers.</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}

$(function() {
  if (typeof legacyTraveler != 'undefined') {
    legacyTravelerApiUrl = legacyTraveler.api;
    legacyDevicesUrl = legacyTraveler.devices;
    legacyAssignedUrl = legacyTraveler.assigned;
    searchLegacy = true;
  }

  ajax401();
  var currentTravelerAoColumns = [
    travelerLinkColumn,
    titleColumn,
    statusColumn,
    deviceColumn,
    sharedWithColumn,
    sharedGroupColumn,
    createdByColumn,
    createdOnColumn,
    deadlineColumn,
    updatedByColumn,
    updatedOnColumn,
    progressColumn,
  ];
  fnAddFilterFoot('#current-traveler-table', currentTravelerAoColumns);
  var currentTravelerTable = $('#current-traveler-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: currentTravelerAoColumns,
    aaSorting: [[7, 'desc'], [9, 'desc']],
    sDom: sDom,
    oTableTools: oTableTools,
  });
  currentTravelerTable.fnClearTable();
  if (device) {
    addData(
      currentTravelerTable,
      prefix + '/currenttravelers/json?device=' + device
    );
    if (searchLegacy) {
      addExternalData(currentTravelerTable, legacyDevicesUrl + device);
    }
  } else {
    addData(currentTravelerTable, prefix + '/currenttravelers/json');
    if (searchLegacy) {
      addExternalData(currentTravelerTable, legacyTravelerApiUrl);
    }
  }
  // binding events
  filterEvent();
});
