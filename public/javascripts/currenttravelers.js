/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, Binder: false*/
/*global selectColumn: false, formLinkColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, fnAddFilterFoot: false, sDom: false, oTableTools: false, fnSelectAll: false, fnDeselect: false, createdByColumn: false, createdOnColumn: false, travelerConfigLinkColumn: false, travelerShareLinkColumn: false, travelerLinkColumn: false, statusColumn: false, deviceColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false*/

function addData(oTable, url) {
  $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json'
  }).done(function (json) {
    oTable.fnAddData(json);
    oTable.fnDraw();
  }).fail(function (jqXHR, status, error) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms and travelers.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();
}

var externalUrl = "https://liud-dev:8181/traveler/showForm.php?assigned=";

var template = {
  title: {
    path: "$.TravelerNumber",
    default: "unknown"
  },
  devices: {
    path: "$.Device",
    transform: function (data) {
      return [data];
    }
  },
  createdBy: {
    path: "$.Creator"
  },
  createdOn: {
    path: "$.AssignedOn"
  },
  status: {
    path: "$.Completed",
    transform: function (data) {
      return data ? 2 : 1;
    }
  },
  url: {
    path: "$.ID",
    transform: function (data) {
      return externalUrl + data;
    }
  }
}


function transform(json) {
  var prop, output = {}, valueFromPath;
  for (prop in template) {
    if (template.hasOwnProperty(prop)) {
      valueFromPath = jsonPath.eval(json, template[prop].path);
      if (valueFromPath.length == 1) {
        if (typeof template[prop].transform == 'function') {
          output[prop] = template[prop].transform(valueFromPath[0]);
        } else {
          output[prop] = valueFromPath[0];
        }
      } else {
        output[prop] = null;
      }
    }
  }
  return output;
}

function addExternalData(oTable, url) {
  $.ajax({
    url: url,
    type: 'GET',
    dataType: 'json'
  }).done(function (json) {
    var transformed = [], i, size = json.length;
    for (i = 0; i < size; i += 1) {
      transformed[i] = transform(json[i]);
    }
    oTable.fnAddData(transformed);
    oTable.fnDraw();
  }).fail(function (jqXHR, status, error) {
    if (jqXHR.status !== 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for forms and travelers.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  }).always();
}

function formatTravelerStatus(s) {
  var status = {
    '1': 'active',
    '1.5': 'submitted for completion',
    '2': 'completed',
    '3': 'frozen',
    '0': 'initialized'
  };
  if (status['' + s]) {
    return status['' + s];
  }
  return 'unknown';
}
$(function () {
  $(document).ajaxError(function (event, jqXHR, settings, exception) {
    if (jqXHR.status == 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="/" target="_blank">home</a>, log in, and then save the changes on this page.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });
  var currentTravelerAoColumns = [travelerLinkColumn, titleColumn, statusColumn, deviceColumn, sharedWithColumn, createdByColumn, createdOnColumn, deadlineColumn, updatedByColumn, updatedOnColumn, progressColumn];
  fnAddFilterFoot('#current-traveler-table', currentTravelerAoColumns);
  var currentTravelerTable = $('#current-traveler-table').dataTable({
    aaData: [],
    // bAutoWidth: false,
    aoColumns: currentTravelerAoColumns,
    aaSorting: [
      [6, 'desc'],
      [8, 'desc']
    ],
    sDom: sDom,
    oTableTools: oTableTools
  });
  currentTravelerTable.fnClearTable();
  if (device) {
    addData(currentTravelerTable, '/currenttravelers/json?device=' + device);
    // addExternalData(currentTravelerTable, '/currenttravelersinv1/json?device=' + device);
    addExternalData(currentTravelerTable, 'https://liud-dev:8181/traveler/api.php?resource=travelers&device=' + device);
  } else {
    addData(currentTravelerTable, '/currenttravelers/json');
    // addExternalData(currentTravelerTable, '/currenttravelersinv1/json');
    addExternalData(currentTravelerTable, 'https://liud-dev:8181/traveler/api.php?resource=travelers');
  }
  // binding events
  filterEvent();
});
