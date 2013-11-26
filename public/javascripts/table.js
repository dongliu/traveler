// global cable variables

var selectColumn = {
  sTitle: '',
  sDefaultContent: '<label class="checkbox"><input type="checkbox" class="select-row"></label>',
  sSortDataType: 'dom-checkbox',
  asSorting: ['desc', 'asc']
};

var idColumn = {
  sTitle: '',
  mData: '_id',
  bVisible: false
};

var formLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data, type, full) {
    return '<a href="/forms/' + data + '/" target="_blank"><i class="fa fa-edit fa-lg"></i></a>';
  },
  bSortable: false
};

var createdOnColumn = dateColumn('Created', 'createdOn');
var createdByColumn = personColumn('Created by', 'createdBy');

var updatedOnColumn = dateColumn('Updated', 'updatedOn');
var updatedByColumn = personColumn('Updated by', 'updatedBy');

var tagsColumn = {
  sTitle: 'Tags',
  sDefaultContent: '',
  mData: function(source, type, val) {
    if (source.tags) {
      return source.tags.join();
    } else {
      return '';
    }
  },
  bFilter: true
};


var commentsColumn = {
  sTitle: 'Comments',
  sDefaultContent: '',
  mData: 'comments',
  bFilter: true
};

var titleColumn = {
  sTitle: 'Title',
  mData: 'title',
  bFilter: true
};

var travelerLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data, type, full) {
    return '<a href="/travelers/' + data + '/" target="_blank"><i class="fa fa-edit fa-lg"></i></a>';
  },
  bSortable: false
};

var travelerConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data, type, full) {
    return '<a href="/travelers/' + data + '/config" target="_blank"><i class="fa fa-gear fa-lg"></i></a>';
  },
  bSortable: false
};

var travelerShareLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data, type, full) {
    return '<a href="/travelers/' + data + '/share/" target="_blank"><i class="fa fa-users fa-lg"></i></a>';
  },
  bSortable: false
};

var deviceColumn = {
  sTitle: 'Devices',
  mData: function(source, type, val) {
    if (source.devices) {
      return source.devices.join('; ');
    } else {
      return '';
    }
  },
  bFilter: true
};

var sharedWithColumn = {
  sTitle: 'Shared with',
  mData: function(source, type, val) {
    if (source.sharedWith) {
      if (source.sharedWith.length === 0) {
        return '';
      } else {
        var names = source.sharedWith.map(function(u) {
          return u.username;
        });
        return names.join('; ');
      }
    } else {
      return '';
    }
  },
  bFilter: true
};

var statusColumn = {
  sTitle: 'Status',
  mData: 'status',
  mRender: function(data, type, full){
    return formatTravelerStatus(data);
  },
  bFilter: true
};

function formatTravelerStatus(s) {
  var status = {
    '1': 'active',
    '2': 'completed',
    '3': 'frozen',
    '0': 'initialized'
  };
  if (status['' + s]) {
    return status['' + s];
  }
  return 'unknown';
}

/*shared user columns*/
var useridColumn = personColumn('User id', '_id');

var useridNoLinkColumn = {
  sTitle: 'User id',
  mData: '_id',
  sDefaultContent: '',
  bFilter: true
};

var userNameColumn = {
  sTitle: 'Full name',
  mData: 'username',
  sDefaultContent: '',
  mRender: function(data, type, full) {
    return '<a href = "/users?name=' + data + '" target="_blank">' + data + '</a>';
  },
  bFilter: true
};

var userNameNoLinkColumn = {
  sTitle: 'Full name',
  mData: 'username',
  sDefaultContent: '',
  bFilter: true
};

var accessColumn = {
  sTitle: 'Priviledge',
  mData: 'access',
  sDefaultContent: '',
  mRender: function(data, type, full) {
    if (data == 0) {
      return 'read';
    }
    if (data == 1) {
      return 'write';
    }
  },
  bFilter: true
};

/*device columns*/

var serialColumn = {
  sTitle: 'Serial',
  mData: 'serialNumber',
  sDefaultContent: '',
  bFilter: true
};

var typeColumn = {
  sTitle: 'Type',
  mData: 'componentType',
  sDefaultContent: '',
  bFilter: true
};

var descriptionColumn = {
  sTitle: 'Description',
  mData: 'description',
  sDefaultContent: '',
  bFilter: true
};

var modifiedOnColumn = dateColumn('Modified', 'dateModified');

// {
//   sTitle: 'Modified',
//   mData: 'dateModified',
//   sDefaultContent: '',
//   bFilter: true
// };

var modifiedByColumn = {
  sTitle: 'Modified by',
  mData: 'modifiedBy',
  sDefaultContent: '',
  bFilter: true
};


var oTableTools = {
  "sSwfPath": "/datatables/swf/copy_csv_xls_pdf.swf",
  "aButtons": [
    "copy",
    "print", {
      "sExtends": "collection",
      "sButtonText": 'Save <span class="caret" />',
      "aButtons": ["csv", "xls", "pdf"]
    }
  ]
};

var sDom = "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";


function selectEvent() {
  $('tbody').on('click', 'input.select-row', function(e) {
    if ($(this).prop('checked')) {
      $(e.target).closest('tr').addClass('row-selected');
    } else {
      $(e.target).closest('tr').removeClass('row-selected');
    }
  });
}


function filterEvent() {
  $('tfoot').on('keyup', 'input', function(e) {
    var table = $(this).closest('table');
    var th = $(this).closest('th');
    table.dataTable().fnFilter(this.value, $('tfoot th', table).index(th));
  });
}


function dateColumn(title, key) {
  return {
    sTitle: title,
    mData: function(source, type, val) {
      if (type === 'sort') {
        return source[key];
      }
      return formatDate(source[key]);
    },
    sDefaultContent: ''
  };
}

function personColumn(title, key) {
  return {
    sTitle: title,
    mData: key,
    sDefaultContent: '',
    mRender: function(data, type, full) {
      return '<a href = "/users/' + data + '" target="_blank">' + data + '</a>';
    },
    bFilter: true
  };
}

function fnWrap(oTableLocal) {
  $(oTableLocal.fnSettings().aoData).each(function() {
    $(this.nTr).removeClass('nowrap');
  });
  oTableLocal.fnAdjustColumnSizing();
}

function fnUnwrap(oTableLocal) {
  $(oTableLocal.fnSettings().aoData).each(function() {
    $(this.nTr).addClass('nowrap');
  });
  oTableLocal.fnAdjustColumnSizing();
}



function fnGetSelected(oTableLocal, selectedClass) {
  var aReturn = [];
  var aTrs = oTableLocal.fnGetNodes();

  for (var i = 0; i < aTrs.length; i++) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      aReturn.push(aTrs[i]);
    }
  }
  return aReturn;
}

function fnSelectAll(oTableLocal, selectedClass, checkboxClass, filtered) {
  fnDeselect(oTableLocal, selectedClass, checkboxClass);
  var settings = oTableLocal.fnSettings();
  var indexes = (filtered === true) ? settings.aiDisplay : settings.aiDisplayMaster;
  indexes.forEach(function(i) {
    var r = oTableLocal.fnGetNodes(i);
    $(r).addClass(selectedClass);
    $(r).find('input.' + checkboxClass).prop('checked', true);
  });
}

function fnDeselect(oTableLocal, selectedClass, checkboxClass) {
  var aTrs = oTableLocal.fnGetNodes();

  for (var i = 0; i < aTrs.length; i++) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      $(aTrs[i]).removeClass(selectedClass);
      $(aTrs[i]).find('input.' + checkboxClass + ':checked').prop('checked', false);
    }
  }
}

function fnSetDeselect(nTr, selectedClass, checkboxClass) {
  if ($(nTr).hasClass(selectedClass)) {
    $(nTr).removeClass(selectedClass);
    $(nTr).find('input.' + checkboxClass + ':checked').prop('checked', false);
  }
}

function fnSetColumnsVis(oTableLocal, columns, show) {
  columns.forEach(function(e, i, a) {
    oTableLocal.fnSetColumnVis(e, show);
  });
}

function fnAddFilterFoot(sTable, aoColumns) {
  var tr = $('<tr role="row">');
  aoColumns.forEach(function(c) {
    if (c.bFilter) {
      tr.append('<th><input type="text" placeholder="' + c.sTitle + '" class="input-medium" autocomplete="off"></th>');
    } else {
      tr.append('<th></th>');
    }
  });
  $(sTable).append($('<tfoot>').append(tr));
}

function formatDate(date) {
  return date ? moment(date).fromNow() : '';
}

function formatDateLong(date) {
  return date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '';
}

$.fn.dataTableExt.oApi.fnAddDataAndDisplay = function(oSettings, aData) {
  /* Add the data */
  var iAdded = this.oApi._fnAddData(oSettings, aData);
  var nAdded = oSettings.aoData[iAdded].nTr;

  /* Need to re-filter and re-sort the table to get positioning correct, not perfect
   * as this will actually redraw the table on screen, but the update should be so fast (and
   * possibly not alter what is already on display) that the user will not notice
   */
  this.oApi._fnReDraw(oSettings);

  /* Find it's position in the table */
  var iPos = -1;
  for (var i = 0, iLen = oSettings.aiDisplay.length; i < iLen; i++) {
    if (oSettings.aoData[oSettings.aiDisplay[i]].nTr == nAdded) {
      iPos = i;
      break;
    }
  }

  /* Get starting point, taking account of paging */
  if (iPos >= 0) {
    oSettings._iDisplayStart = (Math.floor(i / oSettings._iDisplayLength)) * oSettings._iDisplayLength;
    this.oApi._fnCalculateEnd(oSettings);
  }

  this.oApi._fnDraw(oSettings);
  return {
    "nTr": nAdded,
    "iPos": iAdded
  };
};

$.fn.dataTableExt.oApi.fnDisplayRow = function(oSettings, nRow) {
  // Account for the "display" all case - row is already displayed
  if (oSettings._iDisplayLength == -1) {
    return;
  }

  // Find the node in the table
  var iPos = -1;
  for (var i = 0, iLen = oSettings.aiDisplay.length; i < iLen; i++) {
    if (oSettings.aoData[oSettings.aiDisplay[i]].nTr == nRow) {
      iPos = i;
      break;
    }
  }

  // Alter the start point of the paging display
  if (iPos >= 0) {
    oSettings._iDisplayStart = (Math.floor(i / oSettings._iDisplayLength)) * oSettings._iDisplayLength;
    this.oApi._fnCalculateEnd(oSettings);
  }

  this.oApi._fnDraw(oSettings);
};