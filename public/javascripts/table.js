/*global moment: false*/
/*global prefix: false, linkTarget: false*/

function formatDate(date) {
  return date ? moment(date).fromNow() : '';
}

function formatDateLong(date) {
  return date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '';
}

function selectEvent() {
  $('tbody').on('click', 'input.select-row', function(e) {
    if ($(this).prop('checked')) {
      $(e.target)
        .closest('tr')
        .addClass('row-selected');
    } else {
      $(e.target)
        .closest('tr')
        .removeClass('row-selected');
    }
  });
}

function selectOneEvent(oTable) {
  $('tbody').on('click', 'input.select-row', function(e) {
    var tr = $(e.target).closest('tr');
    if ($(tr).hasClass('row-selected')) {
      $(tr).removeClass('row-selected');
    } else {
      oTable.$('tr.row-selected').removeClass('row-selected');
      oTable
        .$('input.select-row')
        .not(this)
        .prop('checked', false);
      $(tr).addClass('row-selected');
    }
  });
}

function filterEvent() {
  $('.filter').on('keyup', 'input', function(e) {
    var table = $(this).closest('table');
    var th = $(this).closest('th');
    var filter = $(this).closest('.filter');
    var index;
    if (filter.is('thead')) {
      index = $('thead.filter th', table).index(th);
      $('tfoot.filter th:nth-child(' + (index + 1) + ') input', table).val(
        this.value
      );
    } else {
      index = $('tfoot.filter th', table).index(th);
      $('thead.filter th:nth-child(' + (index + 1) + ') input', table).val(
        this.value
      );
    }
    table.dataTable().fnFilter(this.value, index);
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
    sDefaultContent: '',
  };
}

function longDateColumn(title, key) {
  return {
    sTitle: title,
    mData: function(source, type, val) {
      if (type === 'sort') {
        return source[key];
      }
      return formatDateLong(source[key]);
    },
    sDefaultContent: '',
    bFilter: true,
  };
}

function personColumn(title, key) {
  return {
    sTitle: title,
    mData: key,
    sDefaultContent: '',
    mRender: function(data, type) {
      if (type === 'sort' || type === 'filter') {
        return data;
      } else if (data) {
        return (
          '<img class="user" data-src="holder.js/27x40?size=20&text=' +
          data.substr(0, 1).toUpperCase() +
          '" src="' +
          prefix +
          '/adusers/' +
          data +
          '/photo" title="' +
          data +
          '">'
        );
      } else {
        return '';
      }
    },
    bFilter: true,
  };
}

function keyValueColumn(collection, key) {
  return {
    sTitle: key,
    mData: collection + '.' + key + '.value',
    sDefaultContent: '',
    bFilter: true,
  };
}

function keyLabelColumn(key) {
  return {
    sTitle: 'label',
    mData: 'user_defined.' + key + '.label',
    sDefaultContent: '',
    bFilter: true,
  };
}

function valueLabel(data) {
  var output = '';
  if (data.value) {
    output += '<span class="input-value">' + data.value + '</span>';
    if (data.label) {
      output += '<span class="input-label"> (' + data.label + ')</span>';
    }
  }
  return output;
}

function keyValueLableColumn(key) {
  return {
    sTitle: key,
    mData: 'user_defined.' + key,
    sDefaultContent: '',
    mRender: function(data, type) {
      if (type === 'sort' || type === 'filter') {
        return data.value;
      } else if (data) {
        return valueLabel(data);
      } else {
        return '';
      }
    },
    bFilter: true,
  };
}

function personNameColumn(title, key) {
  return {
    sTitle: title,
    mData: key,
    sDefaultContent: '',
    mRender: function(data, type, full) {
      return (
        '<a href = "/usernames/' +
        data +
        '" target="' +
        linkTarget +
        '" >' +
        data +
        '</a>'
      );
    },
    bFilter: true,
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
  var aReturn = [],
    i;
  var aTrs = oTableLocal.fnGetNodes();

  for (i = 0; i < aTrs.length; i++) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      aReturn.push(aTrs[i]);
    }
  }
  return aReturn;
}

function fnGetSelectedInPage(oTableLocal, selectedClass, current) {
  if (current) {
    return oTableLocal.$('tr.' + selectedClass, {
      page: 'current',
    });
  }
  return oTableLocal.$('tr.' + selectedClass);
}

function fnDeselect(oTableLocal, selectedClass, checkboxClass) {
  var aTrs = oTableLocal.fnGetNodes();
  var i;

  for (i = 0; i < aTrs.length; i++) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      $(aTrs[i]).removeClass(selectedClass);
      $(aTrs[i])
        .find('input.' + checkboxClass + ':checked')
        .prop('checked', false);
    }
  }
}

function fnSelectAll(oTableLocal, selectedClass, checkboxClass, current) {
  fnDeselect(oTableLocal, selectedClass, checkboxClass);
  var rows;
  var i;
  if (current) {
    rows = oTableLocal.$('tr', {
      page: 'current',
      // When page is 'current', the following two options are forced:
      // 'filter':'applied' and 'order':'current'
    });
  } else {
    rows = oTableLocal.$('tr');
  }

  for (i = 0; i < rows.length; i += 1) {
    $(rows[i]).addClass(selectedClass);
    $(rows[i])
      .find('input.' + checkboxClass)
      .prop('checked', true);
  }
}

function fnSetDeselect(nTr, selectedClass, checkboxClass) {
  if ($(nTr).hasClass(selectedClass)) {
    $(nTr).removeClass(selectedClass);
    $(nTr)
      .find('input.' + checkboxClass + ':checked')
      .prop('checked', false);
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
      tr.append(
        '<th><input type="text" placeholder="' +
          c.sTitle +
          '" style="width:80%;" autocomplete="off"></th>'
      );
    } else {
      tr.append('<th></th>');
    }
  });
  $(sTable).append($('<tfoot class="filter">').append(tr));
}

function fnAddFilterHead(sTable, aoColumns) {
  var tr = $('<tr role="row">');
  aoColumns.forEach(function(c) {
    if (c.bFilter) {
      tr.append(
        '<th><input type="text" placeholder="' +
          c.sTitle +
          '" style="width:80%;" autocomplete="off"></th>'
      );
    } else {
      tr.append('<th></th>');
    }
  });
  $(sTable).append($('<thead class="filter">').append(tr));
}

function formatTravelerStatus(s) {
  var status = {
    '1': 'active',
    '1.5': 'submitted for completion',
    '2': 'completed',
    '3': 'frozen',
    '4': 'archived',
    '0': 'initialized',
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
}

function formatFormStatus(s) {
  var status = {
    '0': 'editable',
    '0.5': 'ready to publish',
    '1': 'published',
    '2': 'obsoleted',
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
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
  var i, iLen;

  for (i = 0, iLen = oSettings.aiDisplay.length; i < iLen; i++) {
    if (oSettings.aoData[oSettings.aiDisplay[i]].nTr === nAdded) {
      iPos = i;
      break;
    }
  }

  /* Get starting point, taking account of paging */
  if (iPos >= 0) {
    oSettings._iDisplayStart =
      Math.floor(i / oSettings._iDisplayLength) * oSettings._iDisplayLength;
    this.oApi._fnCalculateEnd(oSettings);
  }

  this.oApi._fnDraw(oSettings);
  return {
    nTr: nAdded,
    iPos: iAdded,
  };
};

$.fn.dataTableExt.oApi.fnDisplayRow = function(oSettings, nRow) {
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
    oSettings._iDisplayStart =
      Math.floor(i / oSettings._iDisplayLength) * oSettings._iDisplayLength;
    this.oApi._fnCalculateEnd(oSettings);
  }

  this.oApi._fnDraw(oSettings);
};

var selectColumn = {
  sTitle: '',
  sDefaultContent:
    '<label class="checkbox"><input type="checkbox" class="select-row"></label>',
  sSortDataType: 'dom-checkbox',
  asSorting: ['desc', 'asc'],
};

var userIdColumn = {
  sTitle: 'User Id',
  mRender: function(data) {
    return '<label>' + data + '</label>';
  },
  mData: '_id',
  bSortable: true,
  sWidth: '30px',
};

var previewColumn = {
  sTitle: '',
  mData: '_id',
  bSortable: false,
  mRender: function(data) {
    return (
      '<a data-toggle="tooltip" title="preview the traveler with this form" class="preview" id="' +
      data +
      '"><i class="fa fa-eye fa-lg"></i></a>'
    );
  },
  sWidth: '25px',
};

var removeColumn = {
  sTitle: '',
  mData: '_id',
  bSortable: false,
  mRender: function(data) {
    return (
      '<a data-toggle="tooltip" title="remove the item" class="remove text-warning" id="' +
      data +
      '"><i class="fa fa-trash fa-lg"></i></a>'
    );
  },
};

var referenceFormLinkColumn = {
  sTitle: 'Ref',
  mData: 'reference',
  mRender: function(data) {
    return (
      '<a href="' +
      prefix +
      '/forms/' +
      data +
      '/" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>'
    );
  },
  bSortable: false,
  sWidth: '45px',
};

var formColumn = {
  sTitle: 'Link',
  mData: '_id',
  mRender: function(data) {
    return (
      '<a href="' +
      prefix +
      '/forms/' +
      data +
      '/" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>'
    );
  },
  bSortable: false,
  sWidth: '45px',
};

var aliasColumn = {
  sTitle: 'Alias',
  mData: 'alias',
  bFilter: true,
};

var activatedOnColumn = {
  sTitle: 'Activated',
  mData: function(source, type) {
    var a = source.activatedOn;
    if (type === 'sort') {
      return a[a.length - 1];
    }
    return formatDate(a[a.length - 1]);
  },
  sDefaultContent: '',
};

var idColumn = {
  sTitle: '',
  mData: '_id',
  bVisible: false,
};

const formLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data) {
    return (
      '<a href="' +
      prefix +
      '/forms/' +
      data +
      '/" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

const releasedFormLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data) {
    return (
      '<a href="' +
      prefix +
      '/released-forms/' +
      data +
      '/" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="go to the form"><i class="fa fa-eye fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

var formConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data, type, full) {
    return (
      '<a href="' +
      prefix +
      '/forms/' +
      data +
      '/config" data-toggle="tooltip" title="config the form"><i class="fa fa-gear fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

function cloneForm(id, type, title) {
  $.ajax({
    url: '/' + type + '/' + id + '/clone',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      title: title,
    }),
  })
    .done(function(d) {
      $('#message').append(
        '<div class="alert alert-success">' +
          '<button class="close" data-dismiss="alert">x</button>The form was cloned. ' +
          d +
          '</div>'
      );
    })
    .fail(function(jqXHR) {
      $('#message').append(
        '<div class="alert alert-error">' +
          '<button class="close" data-dismiss="alert">x</button>' +
          jqXHR.responseText +
          '.</div>'
      );
    });
}

function cloneModal(id, type) {
  $('#modalLabel').html('Specify the title');
  $('#modal .modal-body').empty();

  $('#modal .modal-body').append(
    '<div><input type="text" value="clone"></div>'
  );

  $('#modal .modal-footer').html(
    '<button id="submit" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
  $('#submit').click(function() {
    cloneForm(id, type, $('#modal input').val());
  });
}

function cloneColumn(type) {
  return {
    sTitle: 'Clone',
    mData: '_id',
    mRender: function(data) {
      return (
        '<a href="#" onclick="cloneModal(\'' +
        data +
        "', '" +
        type +
        '\');" data-toggle="tooltip" title="clone the form"><i class="fa fa-copy fa-lg"></i></a>'
      );
    },
    bSortable: false,
  };
}

var formCloneColumn = cloneColumn('forms');

var releasedFormCloneColumn = cloneColumn('released-forms');

var formShareLinkColumn = {
  sTitle: '',
  mData: function(source) {
    if (source.publicAccess >= 0) {
      return (
        '<a href="' +
        prefix +
        '/forms/' +
        source._id +
        '/share/" target="' +
        linkTarget +
        '" data-toggle="tooltip" title="share the form" class="text-success"><i class="fa fa-users fa-lg"></i></a>'
      );
    }
    return (
      '<a href="' +
      prefix +
      '/forms/' +
      source._id +
      '/share/" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="share the form"><i class="fa fa-users fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

var createdOnColumn = dateColumn('Created', 'createdOn');
var createdByColumn = personColumn('Created by', 'createdBy');
var ownerColumn = {
  sTitle: 'Owner',
  sDefaultContent: '',
  mData: function(source, type) {
    var owner = source.owner || source.createdBy;
    if (type === 'sort' || type === 'filter') {
      return owner;
    } else if (owner) {
      return (
        '<a target="' +
        linkTarget +
        '" href="/users/' +
        owner +
        '"><img class="user" data-src="holder.js/27x40?size=20&text=' +
        owner.substr(0, 1).toUpperCase() +
        '" src="' +
        prefix +
        '/adusers/' +
        owner +
        '/photo" title="' +
        owner +
        '"></a>'
      );
    } else {
      return '';
    }
  },
  bFilter: true,
};

var clonedByColumn = personColumn('Cloned by', 'clonedBy');

var updatedOnColumn = dateColumn('Updated', 'updatedOn');
var updatedByColumn = personColumn('Updated by', 'updatedBy');

const releasedOnColumn = longDateColumn('Released', 'releasedOn');
const releasedByColumn = personColumn('Released by', 'releasedBy');

var transferredOnColumn = dateColumn('transferred', 'transferredOn');

const archivedOnColumn = dateColumn('Archived', 'archivedOn');
const archivedByColumn = personColumn('Archived by', 'archivedBy');

var deadlineColumn = dateColumn('Deadline', 'deadline');

var tagsColumn = {
  sTitle: 'Tags',
  sDefaultContent: '',
  mData: function(source, type, val) {
    return source.tags || [];
  },
  mRender: function(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data.join(' ');
    } else {
      return data.join('; ');
    }
  },
  bFilter: true,
};

var keysColumn = {
  sTitle: 'Reporting IDs',
  sDefaultContent: '',
  mData: function(source, type, val) {
    if (source.mapping) {
      return Object.keys(source.mapping);
    }
    return [];
  },
  mRender: function(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data.join(' ');
    } else {
      return data.join('; ');
    }
  },
  bAutoWidth: false,
  sWidth: '210px',
  bFilter: true,
};

var commentsColumn = {
  sTitle: 'Comments',
  sDefaultContent: '',
  mData: 'comments',
  bFilter: true,
};

var titleColumn = {
  sTitle: 'Title',
  sDefaultContent: '',
  mData: 'title',
  bFilter: true,
};

var versionColumn = {
  sTitle: 'Ver',
  mData: '_v',
  sDefaultContent: '',
  bFilter: true,
  sWidth: '45px',
};

var releasedFormVersionColumn = {
  sTitle: 'Ver',
  mData: 'ver',
  sDefaultContent: '',
  bFilter: true,
  sWidth: '45px',
};

var formTypeColumn = {
  sTitle: 'Type',
  mData: 'formType',
  sDefaultContent: 'normal',
  bFilter: true,
};

function formatFormStatus(s) {
  var status = {
    '0': 'draft',
    '0.5': 'submitted',
    '1': 'pre released',
    '2': 'archived',
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
}

var formStatusColumn = {
  sTitle: 'Status',
  mData: function(source, type, val) {
    return formatFormStatus(source.status);
  },
  bFilter: true,
};

function formatReleasedFormStatus(s) {
  var status = {
    '1': 'released',
    '2': 'archived',
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
}

var releasedFormStatusColumn = {
  sTitle: 'Status',
  mData: function(source, type, val) {
    return formatReleasedFormStatus(source.status);
  },
  bFilter: true,
};

var travelerLinkColumn = {
  sTitle: '',
  mData: function(source, type, val) {
    if (source.hasOwnProperty('url')) {
      return (
        '<a href="' +
        source.url +
        '" data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a>'
      );
    }
    if (source.hasOwnProperty('_id')) {
      return (
        '<a href="' +
        prefix +
        '/travelers/' +
        source._id +
        '/" data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a>'
      );
    }
    return 'unknown';
  },
  bSortable: false,
};

var travelerConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data, type, full) {
    return (
      '<a href="' +
      prefix +
      '/travelers/' +
      data +
      '/config" data-toggle="tooltip" title="config the traveler"><i class="fa fa-gear fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

var travelerShareLinkColumn = {
  sTitle: '',
  mData: function(source) {
    if (source.publicAccess >= 0) {
      return (
        '<a href="' +
        prefix +
        '/travelers/' +
        source._id +
        '/share/" target="' +
        linkTarget +
        '" data-toggle="tooltip" title="share the traveler" class="text-success"><i class="fa fa-users fa-lg"></i></a>'
      );
    }
    return (
      '<a href="' +
      prefix +
      '/travelers/' +
      source._id +
      '/share/" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="share the traveler"><i class="fa fa-users fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

var binderLinkColumn = {
  sTitle: '',
  mData: function(source, type, val) {
    if (source.hasOwnProperty('url')) {
      return (
        '<a href="' +
        source.url +
        '" target="' +
        linkTarget +
        '" data-toggle="tooltip" title="go to the binder"><i class="fa fa-eye fa-lg"></i></a>'
      );
    }
    if (source.hasOwnProperty('_id')) {
      return (
        '<a href="' +
        prefix +
        '/binders/' +
        source._id +
        '/" target="' +
        linkTarget +
        '" data-toggle="tooltip" title="go to the binder"><i class="fa fa-eye fa-lg"></i></a>'
      );
    }
    return 'unknown';
  },
  bSortable: false,
};

var binderConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender: function(data, type, full) {
    return (
      '<a href="' +
      prefix +
      '/binders/' +
      data +
      '/config" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="config the binder"><i class="fa fa-gear fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

var binderShareLinkColumn = {
  sTitle: '',
  mData: function(source) {
    if (source.publicAccess >= 0) {
      return (
        '<a href="' +
        prefix +
        '/binders/' +
        source._id +
        '/share/" target="' +
        linkTarget +
        '" data-toggle="tooltip" title="share the binder" class="text-success"><i class="fa fa-users fa-lg"></i></a>'
      );
    }
    return (
      '<a href="' +
      prefix +
      '/binders/' +
      source._id +
      '/share/" target="' +
      linkTarget +
      '" data-toggle="tooltip" title="share the binder"><i class="fa fa-users fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

var deviceTravelerLinkColumn = {
  sTitle: '',
  mData: 'inventoryId',
  mRender: function(data, type, full) {
    return (
      '<a href="' +
      prefix +
      '/currenttravelers/?device=' +
      data +
      '" data-toggle="tooltip" title="travelers for this device"><i class="fa fa-search fa-lg"></i></a>'
    );
  },
  bSortable: false,
};

function progressBar(active, finished, inProgress, text, width) {
  var w = width || '100px';
  var t = text || '';
  var bar = $(
    '<div class="progress" style="width: ' +
      w +
      ';"><div class="bar bar-success" style="width:' +
      finished +
      '%;"></div><div class="bar bar-info" style="width:' +
      inProgress +
      '%;"></div><div class="progress-value">' +
      t +
      '</div></div>'
  );
  if (active) {
    bar.addClass('active').addClass('progress-striped');
  }
  return bar[0].outerHTML;
}

var travelerProgressColumn = {
  sTitle: 'Estimated progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '105px',
  mData: function(source, type) {
    if (source.status === 2) {
      if (type === 'sort') {
        return 1;
      }
      return progressBar(false, 100, 0);
    }

    var inProgress;

    if (!source.hasOwnProperty('totalInput')) {
      if (type === 'sort') {
        return 0;
      }
      return 'unknown';
    }

    if (source.totalInput === 0) {
      if (type === 'sort') {
        return 0;
      }
      return progressBar(source.status === 1, 0, 0);
    }

    if (!source.hasOwnProperty('finishedInput')) {
      if (type === 'sort') {
        return 0;
      }
      return 'unknown';
    }

    inProgress = Math.floor((source.finishedInput / source.totalInput) * 100);

    return progressBar(
      source.status === 1,
      0,
      inProgress,
      '' + source.finishedInput + ' / ' + source.totalInput
    );
  },
};

var workProgressColumn = {
  sTitle: 'Estimated progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '210px',
  mData: function(source, type) {
    var w = '200px';
    if (source.status === 2) {
      if (type === 'sort') {
        return 1;
      }
      return progressBar(
        false,
        100,
        0,
        '' + source.value + ' + 0 / ' + source.value,
        w
      );
    }

    var inProgress = source.inProgress;
    var finished = 0;

    if (source.hasOwnProperty('finished')) {
      finished = source.finished;
    }

    if (type === 'sort') {
      return finished + inProgress;
    }

    return progressBar(
      source.status === 1,
      finished * 100,
      inProgress * 100,
      '' +
        Math.round(finished * source.value) +
        ' + ' +
        Math.round(inProgress * source.value) +
        ' / ' +
        Math.round(source.value),
      w
    );
  },
};

var binderWorkProgressColumn = {
  sTitle: 'Work progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '105px',
  mData: function(source, type, val) {
    if (source.status === 2) {
      if (type === 'sort') {
        return 1;
      }
      return progressBar(false, 100, 0);
    }

    if (source.totalWork === 0) {
      if (type === 'sort') {
        return 0;
      }
      return progressBar(false, 0, 0);
    }

    var inProgress = source.inProgressWork / source.totalWork;
    var finished = source.finishedWork / source.totalWork;

    if (type === 'sort') {
      return finished + inProgress;
    }

    return progressBar(
      source.status === 1,
      finished * 100,
      inProgress * 100,
      '' +
        source.finishedWork +
        ' / ' +
        source.totalWork +
        ' + ' +
        source.finishedInput +
        ' / ' +
        source.totalInput
    );
  },
};

var binderValueProgressColumn = {
  sTitle: 'Value progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '105px',
  mData: function(source, type, val) {
    if (source.status === 2) {
      if (type === 'sort') {
        return 1;
      }
      return progressBar(false, 100, 0);
    }

    if (source.totalValue === 0) {
      if (type === 'sort') {
        return 0;
      }
      return progressBar(false, 0, 0);
    }

    var inProgress = source.inProgressValue / source.totalValue;
    var finished = source.finishedValue / source.totalValue;

    if (type === 'sort') {
      return finished + inProgress;
    }

    return progressBar(
      source.status === 1,
      finished * 100,
      inProgress * 100,
      '' +
        Math.round(source.finishedValue) +
        ' + ' +
        Math.round(source.inProgressValue) +
        ' / ' +
        Math.round(source.totalValue)
    );
  },
};

var deviceColumn = {
  sTitle: 'Devices',
  mData: function(source, type, val) {
    return source.devices || [];
  },
  mRender: function(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data.join(' ');
    } else {
      return data.join('; ');
    }
  },
  bFilter: true,
};

function usersColumn(title, prop) {
  return {
    sTitle: title,
    mData: function(source, type) {
      if (source[prop]) {
        if (source[prop].length === 0) {
          return '';
        }
        var names = source[prop].map(function(u) {
          if (!u._id) {
            return u;
          }
          if (type === 'filter' || type === 'sort') {
            return u.username;
          } else {
            return (
              '<a target="' +
              linkTarget +
              '" href="/users/' +
              u._id +
              '"><img class="user" data-src="holder.js/27x40?size=20&text=' +
              u._id.substr(0, 1).toUpperCase() +
              '" src="' +
              prefix +
              '/adusers/' +
              u._id +
              '/photo" title="' +
              u.username +
              '"></a>'
            );
          }
        });
        if (type === 'filter' || type === 'sort') {
          return names.join('; ');
        } else {
          return names.join(' ');
        }
      }
      return '';
    },
    bFilter: true,
  };
}

function usersFilteredColumn(title, filter) {
  return {
    sTitle: title,
    mData: function(source, type) {
      var users = filter(source);
      if (users.length === 0) {
        return '';
      }
      var names = users.map(function(u) {
        if (!u._id) {
          return u;
        }
        if (type === 'filter' || type === 'sort') {
          return u.username;
        } else {
          return (
            '<a target="' +
            linkTarget +
            '" href="/users/' +
            u._id +
            '"><img class="user" data-src="holder.js/27x40?size=20&text=' +
            u._id.substr(0, 1).toUpperCase() +
            '" src="' +
            prefix +
            '/adusers/' +
            u._id +
            '/photo" title="' +
            u.username +
            '"></a>'
          );
        }
      });
      if (type === 'filter' || type === 'sort') {
        return names.join('; ');
      } else {
        return names.join(' ');
      }
    },
    bFilter: true,
  };
}

var sharedWithColumn = usersColumn('Shared with', 'sharedWith');

function notIn(user, users) {
  var i;
  for (i = 0; i < users.length; i += 1) {
    if (users[i]._id === user._id) {
      return false;
    }
  }
  return true;
}

var manPowerColumn = usersFilteredColumn('Powered by', function(source) {
  var out = [];
  if (source.manPower) {
    source.manPower.forEach(function(m) {
      if (notIn(m, out)) {
        out.push(m);
      }
    });
  }

  if (source.sharedWith) {
    source.sharedWith.forEach(function(s) {
      if (s.access === 1) {
        if (notIn(s, out)) {
          out.push(s);
        }
      }
    });
  }
  return out;
});

var filledByColumn = usersColumn('Filled by', 'manPower');

var sharedGroupColumn = {
  sTitle: 'Shared groups',
  mData: function(source, type, val) {
    if (source.sharedGroup) {
      if (source.sharedGroup.length === 0) {
        return '';
      }
      var names = source.sharedGroup.map(function(g) {
        return g.groupname;
      });
      return names.join('; ');
    }
    return '';
  },
  bFilter: true,
};

var statusColumn = {
  sTitle: 'Status',
  mData: 'status',
  mRender: function(data, type, full) {
    return formatTravelerStatus(data);
  },
  bFilter: true,
};

var formStatusColumn = {
  sTitle: 'Status',
  mData: 'status',
  mRender: function(data, type, full) {
    return formatFormStatus(data);
  },
  bFilter: true,
};

/*shared user columns*/
var useridColumn = personColumn('User', '_id');

var useridNoLinkColumn = {
  sTitle: 'User id',
  mData: '_id',
  sDefaultContent: '',
  bFilter: true,
};

var userNameColumn = {
  sTitle: 'Full name',
  mData: 'username',
  sDefaultContent: '',
  mRender: function(data, type, full) {
    return (
      '<a href = "' + prefix + '/users?name=' + data + '">' + data + '</a>'
    );
  },
  bFilter: true,
};

var userNameNoLinkColumn = {
  sTitle: 'Full name',
  mData: 'username',
  sDefaultContent: '',
  bFilter: true,
};

var fullNameNoLinkColumn = {
  sTitle: 'Full name',
  mData: 'name',
  sDefaultContent: '',
  bFilter: true,
};

var groupIdColumn = {
  sTitle: 'Group id',
  mData: '_id',
  sDefaultContent: '',
  bFilter: true,
  mRender: function(data) {
    return '<a href="' + prefix + '/groups/' + data + '">' + data + '</a>';
  },
};

var displayNameColumn = {
  sTitle: 'Display Name',
  mData: 'name',
  sDefaultContent: '',
  bFilter: true,
};

var groupNameColumn = {
  sTitle: 'Group Name',
  mData: 'groupname',
  sDefaultContent: '',
  bFilter: true,
};

var membersColumn = {
  sTitle: 'Member(s)',
  mData: 'members',
  sDefaultContent: '',
  bFilter: false,
  mRender: function(data) {
    data.sort(function(a, b) {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    });
    var result = data.map(function(d) {
      return '<li>' + d.name + '</li>';
    });
    return '<ul>' + result.join('') + '</ul>';
  },
};

var accessColumn = {
  sTitle: 'Privilege',
  mData: 'access',
  sDefaultContent: '',
  mRender: function(data, type, full) {
    if (data === 0) {
      return 'read';
    }
    if (data === 1) {
      return 'write';
    }
  },
  bFilter: true,
};

/*user columns*/
var rolesColumn = {
  sTitle: 'Roles',
  mData: 'roles',
  sDefaultContent: '',
  mRender: function(data, type, full) {
    return data.join();
  },
  bFilter: true,
};

var lastVisitedOnColumn = dateColumn('Last visited', 'lastVisitedOn');

/*device columns*/

var serialColumn = {
  sTitle: 'Serial',
  mData: 'inventoryId',
  sDefaultContent: '',
  bFilter: true,
};

var typeColumn = {
  sTitle: 'Type',
  mData: 'deviceType.name',
  sDefaultContent: '',
  bFilter: true,
};

var descriptionColumn = {
  sTitle: 'Description',
  mData: 'deviceType.description',
  sDefaultContent: '',
  bFilter: true,
};

var modifiedOnColumn = dateColumn('Modified', 'dateModified');

var modifiedByColumn = {
  sTitle: 'Modified by',
  mData: 'modifiedBy',
  sDefaultContent: '',
  bFilter: true,
};

var addedByColumn = personColumn('Added by', 'addedBy');

var addedOnColumn = dateColumn('Added on', 'addedOn');

var sequenceColumn = {
  sTitle: 'Sequence',
  mData: 'sequence',
  sClass: 'editable',
  sType: 'numeric',
  bFilter: true,
  mRender: function(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data;
    } else {
      return (
        '<input type="number" min=1 step=1 class="input-mini config" value="' +
        data +
        '">'
      );
    }
  },
};

var sColumn = {
  sTitle: 'S',
  mData: 'sequence',
  bFilter: true,
};

var priorityColumn = {
  sTitle: 'Priority',
  mData: 'priority',
  sClass: 'editable',
  sType: 'numeric',
  bFilter: true,
  mRender: function(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data;
    } else {
      return (
        '<input type="number" min=1 step=1 class="input-mini config" value="' +
        data +
        '">'
      );
    }
  },
};

var pColumn = {
  sTitle: 'P',
  mData: 'priority',
  bFilter: true,
};

var valueColumn = {
  sTitle: 'Value',
  mData: 'value',
  sClass: 'editable',
  sType: 'numeric',
  bFilter: true,
  mRender: function(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data;
    } else {
      return (
        '<input type="number" min=0 class="input-mini config" value="' +
        data +
        '">'
      );
    }
  },
};

var vColumn = {
  sTitle: 'V',
  mData: 'value',
  bFilter: true,
};

var colorColumn = {
  sTitle: 'Color',
  mData: 'color',
  sClass: 'editable',
  mRender: function(data, type) {
    var snippet;
    if (type === 'sort' || type === 'filter') {
      return data;
    } else {
      snippet = $(
        '<select name="select" class="input-small config"><option value = "blue" class="text-info">blue</option><option value = "green" class="text-success">green</option><option value = "yellow" class="text-warning">yellow</option><option value = "red" class="text-error">red</option><option value = "black">black</option></select>'
      );
      $('option[value="' + data + '"]', snippet).attr('selected', 'selected');
      return snippet[0].outerHTML;
    }
  },
};

var cColumn = {
  sTitle: 'C',
  mData: 'color',
  mRender: function(data, type) {
    var snippet = $('<i class="fa fa-flag fa-lg"></i>');
    if (type === 'sort' || type === 'filter') {
      return data;
    } else {
      switch (data) {
        case 'blue':
          snippet.addClass('text-info');
          break;
        case 'green':
          snippet.addClass('text-success');
          break;
        case 'yellow':
          snippet.addClass('text-warning');
          break;
        case 'red':
          snippet.addClass('text-error');
          break;
        default:
      }
      return snippet[0].outerHTML;
    }
  },
};

/**
 * get a button config that exports only the visible, default all
 * @param  {Sting} tool the tool name to extend
 * @return {Object}     tool defination
 */
function exportVisible(tool) {
  return {
    sExtends: tool,
    mColumns: 'visible',
  };
}

var oTableTools = {
  sSwfPath: prefix
    ? prefix + '/datatables/swf/copy_csv_xls_pdf.swf'
    : '/datatables/swf/copy_csv_xls_pdf.swf',
  aButtons: [
    exportVisible('copy'),
    'print',
    {
      sExtends: 'collection',
      sButtonText: 'Save <span class="caret" />',
      aButtons: [
        exportVisible('csv'),
        exportVisible('xls'),
        exportVisible('pdf'),
      ],
    },
  ],
};

var sDom =
  "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";
var sDom2i =
  "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span3'l><'span3'i><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";
var sDom2i1p =
  "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span3'l><'span3'i><'span3'r><'span3'f>>t<'row-fluid'<'span6'i><'span6'p>>";
var sDomNoTools =
  "<'row-fluid'<'span4'l><'span4'<'text-center'r>><'span4'f>>t<'row-fluid'<'span6'i><'span6'p>>";
var sDomNoTNoR = "t<'row-fluid'<'span6'i><'span6'p>>";
var sDomClean = 't';
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

jQuery.fn.dataTableExt.oApi.fnReloadAjax = function(
  oSettings,
  sNewSource,
  fnCallback,
  bStandingRedraw
) {
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

  oSettings.fnServerData.call(
    oSettings.oInstance,
    oSettings.sAjaxSource,
    aData,
    function(json) {
      /* Clear the old information from the table */
      that.oApi._fnClearTable(oSettings);

      /* Got the data - add it to the table */
      var aData =
        oSettings.sAjaxDataProp !== ''
          ? that.oApi._fnGetObjectDataFn(oSettings.sAjaxDataProp)(json)
          : json;
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
    },
    oSettings
  );
};
