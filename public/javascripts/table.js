/*global moment: false*/
/*global prefix: false*/

function formatDate(date) {
  return date ? moment(date).fromNow() : '';
}

function formatDateLong(date) {
  return date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '';
}

function selectEvent() {
  $('tbody').on('click', 'input.select-row', function (e) {
    if ($(this).prop('checked')) {
      $(e.target).closest('tr').addClass('row-selected');
    } else {
      $(e.target).closest('tr').removeClass('row-selected');
    }
  });
}


function filterEvent() {
  $('tfoot').on('keyup', 'input', function (e) {
    var table = $(this).closest('table');
    var th = $(this).closest('th');
    table.dataTable().fnFilter(this.value, $('tfoot th', table).index(th));
  });
}


function dateColumn(title, key) {
  return {
    sTitle: title,
    mData: function (source, type, val) {
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
    mRender: function (data, type, full) {
      return '<a href = "' + prefix + '/users/' + data + '">' + data + '</a>';
    },
    bFilter: true
  };
}

function fnWrap(oTableLocal) {
  $(oTableLocal.fnSettings().aoData).each(function () {
    $(this.nTr).removeClass('nowrap');
  });
  oTableLocal.fnAdjustColumnSizing();
}

function fnUnwrap(oTableLocal) {
  $(oTableLocal.fnSettings().aoData).each(function () {
    $(this.nTr).addClass('nowrap');
  });
  oTableLocal.fnAdjustColumnSizing();
}



function fnGetSelected(oTableLocal, selectedClass) {
  var aReturn = [];
  var aTrs = oTableLocal.fnGetNodes();
  var i;
  for (i = 0; i < aTrs.length; i++) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      aReturn.push(aTrs[i]);
    }
  }
  return aReturn;
}

function fnDeselect(oTableLocal, selectedClass, checkboxClass) {
  var aTrs = oTableLocal.fnGetNodes();
  var i;
  for (i = 0; i < aTrs.length; i++) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      $(aTrs[i]).removeClass(selectedClass);
      $(aTrs[i]).find('input.' + checkboxClass + ':checked').prop('checked', false);
    }
  }
}

function fnSelectAll(oTableLocal, selectedClass, checkboxClass, filtered) {
  fnDeselect(oTableLocal, selectedClass, checkboxClass);
  var rows, i;
  if (filtered) {
    rows = oTableLocal.$('tr', {"filter":"applied"});
  } else {
    rows = oTableLocal.$('tr');
  }

  for(i = 0; i < rows.length; i += 1) {
    $(rows[i]).addClass(selectedClass);
    $(rows[i]).find('input.' + checkboxClass).prop('checked', true);
  }
}

function fnSetDeselect(nTr, selectedClass, checkboxClass) {
  if ($(nTr).hasClass(selectedClass)) {
    $(nTr).removeClass(selectedClass);
    $(nTr).find('input.' + checkboxClass + ':checked').prop('checked', false);
  }
}

function fnSetColumnsVis(oTableLocal, columns, show) {
  columns.forEach(function (e, i, a) {
    oTableLocal.fnSetColumnVis(e, show);
  });
}

function fnAddFilterFoot(sTable, aoColumns) {
  var tr = $('<tr role="row">');
  aoColumns.forEach(function (c) {
    if (c.bFilter) {
      tr.append('<th><input type="text" placeholder="' + c.sTitle + '" style="width:80%;" autocomplete="off"></th>');
    } else {
      tr.append('<th></th>');
    }
  });
  $(sTable).append($('<tfoot>').append(tr));
}

function formatTravelerStatus(s) {
  var status = {
    '1': 'active',
    '1.5': 'submitted for completion',
    '2': 'completed',
    '3': 'frozen',
    '0': 'initialized'
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
}

$.fn.dataTableExt.oApi.fnAddDataAndDisplay = function (oSettings, aData) {
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
  var i, iLen;

  for (i = 0, iLen = oSettings.aiDisplay.length; i < iLen; i++) {
    if (oSettings.aoData[oSettings.aiDisplay[i]].nTr === nAdded) {
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

$.fn.dataTableExt.oApi.fnDisplayRow = function (oSettings, nRow) {
  // Account for the "display" all case - row is already displayed
  if (oSettings._iDisplayLength === -1) {
    return;
  }

  // Find the node in the table
  var iPos = -1;
  var i, iLen;
  for (i = 0, iLen = oSettings.aiDisplay.length; i < iLen; i++) {
    if (oSettings.aoData[oSettings.aiDisplay[i]].nTr === nRow) {
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

var selectColumn = {
  sTitle: '',
  sDefaultContent: '<label class="checkbox"><input type="checkbox" class="select-row"></label>',
  sSortDataType: 'dom-checkbox',
  asSorting: ['desc', 'asc']
};


var previewColumn = {
  sTitle: '',
  mData: '_id',
  bSortable: false,
  mRender: function (data) {
    return '<a data-toggle="tooltip" title="preview the traveler with this form" class="preview" id="' + data + '"><i class="fa fa-eye fa-lg"></i></a>';
  }
};

var referenceFormLinkColumn = {
  sTitle: 'Reference',
  mData: 'reference',
  mRender: function (data) {
    return '<a href="' + prefix + '/forms/' + data + '/" target="_blank" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>';
  },
  bSortable: false
};

var formColumn = {
  sTitle: 'Link',
  mData: '_id',
  mRender: function (data) {
    return '<a href="' + prefix + '/forms/' + data + '/" target="_blank" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>';
  },
  bSortable: false
};

var aliasColumn = {
  sTitle: 'Alias',
  mData: 'alias',
  bFilter: true
};

var activatedOnColumn = {
  sTitle: 'Activated',
  mData: function (source, type) {
    var a = source.activatedOn;
    if (type === 'sort') {
      return a[a.length - 1];
    }
    return formatDate(a[a.length - 1]);
  },
  sDefaultContent: ''
};

var idColumn = {
  sTitle: '',
  mData: '_id',
  bVisible: false
};

var formLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function (data) {
    return '<a href="' + prefix + '/forms/' + data + '/" target="_blank" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>';
  },
  bSortable: false
};

var formShareLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function (data, type, full) {
    return '<a href="' + prefix + '/forms/' + data + '/share/" data-toggle="tooltip" title="share the form"><i class="fa fa-users fa-lg"></i></a>';
  },
  bSortable: false
};

var createdOnColumn = dateColumn('Created', 'createdOn');
var createdByColumn = personColumn('Created by', 'createdBy');

var clonedByColumn = personColumn('Cloned by', 'clonedBy');

var updatedOnColumn = dateColumn('Updated', 'updatedOn');
var updatedByColumn = personColumn('Updated by', 'updatedBy');

var deadlineColumn = dateColumn('Deadline', 'deadline');

var tagsColumn = {
  sTitle: 'Tags',
  sDefaultContent: '',
  mData: function (source, type, val) {
    if (source.tags) {
      return source.tags.join();
    }
    return '';
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
  mData: function (source, type, val) {
    if (source.hasOwnProperty('url')) {
      return '<a href="' + source.url + '" data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a>';
    }
    if (source.hasOwnProperty('_id')) {
      return '<a href="' + prefix + '/travelers/' + source._id + '/" data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a>';
    }
    return 'unknown';
  },
  bSortable: false
};

var travelerConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function (data, type, full) {
    return '<a href="' + prefix + '/travelers/' + data + '/config" data-toggle="tooltip" title="config the traveler"><i class="fa fa-gear fa-lg"></i></a>';
  },
  bSortable: false
};

var travelerShareLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function (data, type, full) {
    return '<a href="' + prefix + '/travelers/' + data + '/share/"  data-toggle="tooltip" title="share the traveler"><i class="fa fa-users fa-lg"></i></a>';
  },
  bSortable: false
};

var deviceTravelerLinkColumn = {
  sTitle: '',
  mData: 'inventoryId',
  mRender: function (data, type, full) {
    return '<a href="' + prefix + '/currenttravelers/?device=' + data + '" data-toggle="tooltip" title="travelers for this device"><i class="fa fa-search fa-lg"></i></a>';
  },
  bSortable: false
};

var progressColumn = {
  sTitle: 'Estimated progress',
  bSortable: true,
  sType: 'numeric',
  mData: function (source, type, val) {
    if (!source.hasOwnProperty('totalInput')) {
      if (type === 'sort') {
        return 0;
      }
      return '';
    }
    if (source.totalInput === 0) {
      if (type === 'sort') {
        return 0;
      }
      return '';
    }
    if (!source.hasOwnProperty('finishedInput')) {
      if (type === 'sort') {
        return 0;
      }
      return 'unknown';
    }
    var percentage = Math.floor((source.finishedInput / source.totalInput) * 100);
    if (type === 'sort') {
      return percentage;
    }
    return '<div class="progress" style="margin-bottom: 0; width: 100px; background: #FFFF00; position: relative;"><div class="bar" style="width:' + percentage + '%;"></div><span style="position: absolute; text-align: center; width: 100%; z-index: 100; color: #000000; display: block;">' + source.finishedInput + '/' + source.totalInput + '</span></div>';
  }
};

var deviceColumn = {
  sTitle: 'Devices',
  mData: function (source, type, val) {
    if (source.devices) {
      return source.devices.join('; ');
    }
    return '';
  },
  bFilter: true
};

var sharedWithColumn = {
  sTitle: 'Shared with',
  mData: function (source, type, val) {
    if (source.sharedWith) {
      if (source.sharedWith.length === 0) {
        return '';
      }
      var names = source.sharedWith.map(function (u) {
        return u.username;
      });
      return names.join('; ');
    }
    return '';
  },
  bFilter: true
};

var sharedGroupColumn = {
  sTitle: 'Shared groups',
  mData: function (source, type, val) {
    if (source.sharedGroup) {
      if (source.sharedGroup.length === 0) {
        return '';
      }
      var names = source.sharedGroup.map(function (g) {
        return g.groupname;
      });
      return names.join('; ');
    }
    return '';
  },
  bFilter: true
};

var statusColumn = {
  sTitle: 'Status',
  mData: 'status',
  mRender: function (data, type, full) {
    return formatTravelerStatus(data);
  },
  bFilter: true
};

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
  mRender: function (data, type, full) {
    return '<a href = "' + prefix + '/users?name=' + data + '">' + data + '</a>';
  },
  bFilter: true
};

var userNameNoLinkColumn = {
  sTitle: 'Full name',
  mData: 'username',
  sDefaultContent: '',
  bFilter: true
};

var fullNameNoLinkColumn = {
  sTitle: 'Full name',
  mData: 'name',
  sDefaultContent: '',
  bFilter: true
};

var groupNameColumn = {
  sTitle: 'Group name',
  mData: 'groupname',
  sDefaultContent: '',
  bFilter: true
};

var accessColumn = {
  sTitle: 'Privilege',
  mData: 'access',
  sDefaultContent: '',
  mRender: function (data, type, full) {
    if (data === 0) {
      return 'read';
    }
    if (data === 1) {
      return 'write';
    }
  },
  bFilter: true
};

/*user columns*/
var rolesColumn = {
  sTitle: 'Roles',
  mData: 'roles',
  sDefaultContent: '',
  mRender: function (data, type, full) {
    return data.join();
  },
  bFilter: true
};

var lastVisitedOnColumn = dateColumn('Last visited', 'lastVisitedOn');

/*device columns*/

var serialColumn = {
  sTitle: 'Serial',
  mData: 'inventoryId',
  sDefaultContent: '',
  bFilter: true
};

var typeColumn = {
  sTitle: 'Type',
  mData: 'deviceType.name',
  sDefaultContent: '',
  bFilter: true
};

var descriptionColumn = {
  sTitle: 'Description',
  mData: 'deviceType.description',
  sDefaultContent: '',
  bFilter: true
};

var modifiedOnColumn = dateColumn('Modified', 'dateModified');

var modifiedByColumn = {
  sTitle: 'Modified by',
  mData: 'modifiedBy',
  sDefaultContent: '',
  bFilter: true
};


var oTableTools = {
  sSwfPath: prefix ? prefix + '/datatables/swf/copy_csv_xls_pdf.swf' : '/datatables/swf/copy_csv_xls_pdf.swf',
  aButtons: [
    'copy',
    'print', {
      'sExtends': 'collection',
      'sButtonText': 'Save <span class="caret" />',
      'aButtons': ['csv', 'xls', 'pdf']
    }
  ]
};

var sDom = "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";
var sDomNoTools = "<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";
var sDomClean = "t";
var sDomPage = "<'row-fluid'r>t<'row-fluid'<'span6'i><'span6'p>>";

/**
 * By default DataTables only uses the sAjaxSource variable at initialisation
 * time, however it can be useful to re-read an Ajax source and have the table
 * update. Typically you would need to use the `fnClearTable()` and
 * `fnAddData()` functions, however this wraps it all up in a single function
 * call.
 *
 * DataTables 1.10 provides the `dt-api ajax.url()` and `dt-api ajax.reload()`
 * methods, built-in, to give the same functionality as this plug-in. As such
 * this method is marked deprecated, but is available for use with legacy
 * version of DataTables. Please use the new API if you are used DataTables 1.10
 * or newer.
 *
 *  @name fnReloadAjax
 *  @summary Reload the table's data from the Ajax source
 *  @author [Allan Jardine](http://sprymedia.co.uk)
 *  @deprecated
 *
 *  @param {string} [sNewSource] URL to get the data from. If not give, the
 *    previously used URL is used.
 *  @param {function} [fnCallback] Callback that is executed when the table has
 *    redrawn with the new data
 *  @param {boolean} [bStandingRedraw=false] Standing redraw (don't changing the
 *      paging)
 *
 *  @example
 *    var table = $('#example').dataTable();
 *
 *    // Example call to load a new file
 *    table.fnReloadAjax( 'media/examples_support/json_source2.txt' );
 *
 *    // Example call to reload from original file
 *    table.fnReloadAjax();
 */

jQuery.fn.dataTableExt.oApi.fnReloadAjax = function (oSettings, sNewSource, fnCallback, bStandingRedraw) {
  // DataTables 1.10 compatibility - if 1.10 then `versionCheck` exists.
  // 1.10's API has ajax reloading built in, so we use those abilities
  // directly.
  if (jQuery.fn.dataTable.versionCheck) {
    var api = new jQuery.fn.dataTable.Api(oSettings);

    if (sNewSource) {
      api.ajax.url(sNewSource).load(fnCallback, !bStandingRedraw);
    } else {
      api.ajax.reload(fnCallback, !bStandingRedraw);
    }
    return;
  }

  if (sNewSource !== undefined && sNewSource !== null) {
    oSettings.sAjaxSource = sNewSource;
  }

  // Server-side processing should just call fnDraw
  if (oSettings.oFeatures.bServerSide) {
    this.fnDraw();
    return;
  }

  this.oApi._fnProcessingDisplay(oSettings, true);
  var that = this;
  var iStart = oSettings._iDisplayStart;
  var aData = [];

  this.oApi._fnServerParams(oSettings, aData);

  oSettings.fnServerData.call(oSettings.oInstance, oSettings.sAjaxSource, aData, function (json) {
    /* Clear the old information from the table */
    that.oApi._fnClearTable(oSettings);

    /* Got the data - add it to the table */
    var aData = (oSettings.sAjaxDataProp !== "") ? that.oApi._fnGetObjectDataFn(oSettings.sAjaxDataProp)(json) : json;
    var i;
    for (i = 0; i < aData.length; i++) {
      that.oApi._fnAddData(oSettings, aData[i]);
    }

    oSettings.aiDisplay = oSettings.aiDisplayMaster.slice();

    that.fnDraw();

    if (bStandingRedraw === true) {
      oSettings._iDisplayStart = iStart;
      that.oApi._fnCalculateEnd(oSettings);
      that.fnDraw(false);
    }

    that.oApi._fnProcessingDisplay(oSettings, false);

    /* Callback user function - for event handlers etc */
    if (typeof fnCallback == 'function' && fnCallback !== null) {
      fnCallback(oSettings);
    }
  }, oSettings);
};
