/* global moment: false */
/* global prefix: false, linkTarget: false */

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

function selectMultiEvent(oTable) {
  $(oTable.$('tbody')).on('click', 'input.select-row', function(e) {
    const tr = $(e.target).closest('tr');
    if ($(tr).hasClass('row-selected')) {
      $(tr).removeClass('row-selected');
    } else {
      $(tr).addClass('row-selected');
    }
  });
}

function selectOneEvent(oTable) {
  $('tbody').on('click', 'input.select-row', function(e) {
    const tr = $(e.target).closest('tr');
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
    const table = $(this).closest('table');
    const th = $(this).closest('th');
    const filter = $(this).closest('.filter');
    let index;
    if (filter.is('thead')) {
      index = $('thead.filter th', table).index(th);
      $(`tfoot.filter th:nth-child(${index + 1}) input`, table).val(this.value);
    } else {
      index = $('tfoot.filter th', table).index(th);
      $(`thead.filter th:nth-child(${index + 1}) input`, table).val(this.value);
    }
    table.dataTable().fnFilter(this.value, index);
  });
}

function dateColumn(title, key) {
  return {
    sTitle: title,
    mData(source, type, val) {
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
    mData(source, type, val) {
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
    mRender(data, type) {
      if (type === 'sort' || type === 'filter') {
        return data;
      }
      if (data) {
        return `<img class="user" data-src="holder.js/27x40?size=20&text=${data
          .substr(0, 1)
          .toUpperCase()}" src="${prefix}/adusers/${data}/photo" title="${data}">`;
      }
      return '';
    },
    bFilter: true,
  };
}

function keyValueColumn(collection, key) {
  return {
    sTitle: key,
    mData: `${collection}.${key}.value`,
    sDefaultContent: '',
    bFilter: true,
  };
}

function keyLabelColumn(key) {
  return {
    sTitle: 'label',
    mData: `user_defined.${key}.label`,
    sDefaultContent: '',
    bFilter: true,
  };
}

function valueLabel(data) {
  let output = '';
  if (data.value) {
    output += `<span class="input-value">${data.value}</span>`;
    if (data.label) {
      output += `<span class="input-label"> (${data.label})</span>`;
    }
  }
  return output;
}

function keyValueLableColumn(key) {
  return {
    sTitle: key,
    mData: `user_defined.${key}`,
    sDefaultContent: '',
    mRender(data, type) {
      if (type === 'sort' || type === 'filter') {
        return data.value;
      }
      if (data) {
        return valueLabel(data);
      }
      return '';
    },
    bFilter: true,
  };
}

function personNameColumn(title, key) {
  return {
    sTitle: title,
    mData: key,
    sDefaultContent: '',
    mRender(data, type, full) {
      return `<a href = "/usernames/${data}" target="${linkTarget}" >${data}</a>`;
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
  const aReturn = [];
  let i;
  const aTrs = oTableLocal.fnGetNodes();

  for (i = 0; i < aTrs.length; i += 1) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      aReturn.push(aTrs[i]);
    }
  }
  return aReturn;
}

function fnGetSelectedInPage(oTableLocal, selectedClass, current) {
  if (current) {
    return oTableLocal.$(`tr.${selectedClass}`, {
      page: 'current',
    });
  }
  return oTableLocal.$(`tr.${selectedClass}`);
}

function fnDeselect(oTableLocal, selectedClass, checkboxClass) {
  const aTrs = oTableLocal.fnGetNodes();
  let i;

  for (i = 0; i < aTrs.length; i += 1) {
    if ($(aTrs[i]).hasClass(selectedClass)) {
      $(aTrs[i]).removeClass(selectedClass);
      $(aTrs[i])
        .find(`input.${checkboxClass}:checked`)
        .prop('checked', false);
    }
  }
}

function fnSelectAll(oTableLocal, selectedClass, checkboxClass, current) {
  fnDeselect(oTableLocal, selectedClass, checkboxClass);
  let rows;
  let i;
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
      .find(`input.${checkboxClass}`)
      .prop('checked', true);
  }
}

function fnSetDeselect(nTr, selectedClass, checkboxClass) {
  if ($(nTr).hasClass(selectedClass)) {
    $(nTr).removeClass(selectedClass);
    $(nTr)
      .find(`input.${checkboxClass}:checked`)
      .prop('checked', false);
  }
}

function fnSetColumnsVis(oTableLocal, columns, show) {
  columns.forEach(function(e, i, a) {
    oTableLocal.fnSetColumnVis(e, show);
  });
}

function fnAddFilterFoot(sTable, aoColumns) {
  const tr = $('<tr role="row">');
  aoColumns.forEach(function(c) {
    if (c.bFilter) {
      tr.append(
        `<th><input type="text" placeholder="${c.sTitle}" style="width:80%;" autocomplete="off"></th>`
      );
    } else {
      tr.append('<th></th>');
    }
  });
  $(sTable).append($('<tfoot class="filter">').append(tr));
}

function fnAddFilterHead(sTable, aoColumns) {
  const tr = $('<tr role="row">');
  aoColumns.forEach(function(c) {
    if (c.bFilter) {
      tr.append(
        `<th><input type="text" placeholder="${c.sTitle}" style="width:80%;" autocomplete="off"></th>`
      );
    } else {
      tr.append('<th></th>');
    }
  });
  $(sTable).append($('<thead class="filter">').append(tr));
}

function formatTravelerStatus(s) {
  const status = {
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

$.fn.dataTableExt.oApi.fnAddDataAndDisplay = function(oSettings, aData) {
  /* Add the data */
  const iAdded = this.oApi._fnAddData(oSettings, aData);
  const nAdded = oSettings.aoData[iAdded].nTr;

  /* Need to re-filter and re-sort the table to get positioning correct, not perfect
   * as this will actually redraw the table on screen, but the update should be so fast (and
   * possibly not alter what is already on display) that the user will not notice
   */
  this.oApi._fnReDraw(oSettings);

  /* Find it's position in the table */
  let iPos = -1;
  let i;
  let iLen;

  for (i = 0, iLen = oSettings.aiDisplay.length; i < iLen; i += 1) {
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
  let iPos = -1;
  let i;
  let iLen;
  for (i = 0, iLen = oSettings.aiDisplay.length; i < iLen; i += 1) {
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

const selectColumn = {
  sTitle: '',
  sDefaultContent:
    '<label class="checkbox"><input type="checkbox" class="select-row"></label>',
  sSortDataType: 'dom-checkbox',
  asSorting: ['desc', 'asc'],
};

const userIdColumn = {
  sTitle: 'User Id',
  mRender(data) {
    return `<label>${data}</label>`;
  },
  mData: '_id',
  bSortable: true,
  sWidth: '30px',
};

const previewColumn = {
  sTitle: '',
  mData: '_id',
  bSortable: false,
  mRender(data) {
    return `<a data-toggle="tooltip" title="preview the traveler with this form" class="preview" id="${data}"><i class="fa fa-eye fa-lg"></i></a>`;
  },
  sWidth: '25px',
};

const removeColumn = {
  sTitle: '',
  mData: '_id',
  bSortable: false,
  mRender(data) {
    return `<a data-toggle="tooltip" title="remove the item" class="remove text-warning" id="${data}"><i class="fa fa-trash fa-lg"></i></a>`;
  },
};

const referenceFormLinkColumn = {
  sTitle: 'Ref',
  mData: 'reference',
  mRender(data) {
    return `<a href="${prefix}/forms/${data}/" target="${linkTarget}" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>`;
  },
  bSortable: false,
  sWidth: '45px',
};

const formColumn = {
  sTitle: 'Link',
  mData: '_id',
  mRender(data) {
    return `<a href="${prefix}/forms/${data}/" target="${linkTarget}" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>`;
  },
  bSortable: false,
  sWidth: '45px',
};

const aliasColumn = {
  sTitle: 'Alias',
  mData: 'alias',
  bFilter: true,
};

const activatedOnColumn = {
  sTitle: 'Activated',
  mData(source, type) {
    const a = source.activatedOn;
    if (type === 'sort') {
      return a[a.length - 1];
    }
    return formatDate(a[a.length - 1]);
  },
  sDefaultContent: '',
};

const idColumn = {
  sTitle: '',
  mData: '_id',
  bVisible: false,
};

const formLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender(data) {
    return `<a href="${prefix}/forms/${data}/" target="${linkTarget}" data-toggle="tooltip" title="go to the form"><i class="fa fa-edit fa-lg"></i></a>`;
  },
  bSortable: false,
};

const releasedFormLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender(data) {
    return `<a href="${prefix}/released-forms/${data}/" target="${linkTarget}" data-toggle="tooltip" title="go to the form"><i class="fa fa-eye fa-lg"></i></a>`;
  },
  bSortable: false,
};

const formConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender(data, type, full) {
    return `<a href="${prefix}/forms/${data}/config" data-toggle="tooltip" title="config the form"><i class="fa fa-gear fa-lg"></i></a>`;
  },
  bSortable: false,
};

function cloneForm(id, type, title) {
  $.ajax({
    url: `/${type}/${id}/clone`,
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({
      title,
    }),
  })
    .done(function(d) {
      $('#message').append(
        `${'<div class="alert alert-success">' +
          '<button class="close" data-dismiss="alert">x</button>The form was cloned. '}${d}</div>`
      );
    })
    .fail(function(jqXHR) {
      $('#message').append(
        `${'<div class="alert alert-error">' +
          '<button class="close" data-dismiss="alert">x</button>'}${
          jqXHR.responseText
        }.</div>`
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
    mRender(data) {
      return `<a href="#" onclick="cloneModal('${data}', '${type}');" data-toggle="tooltip" title="clone the form"><i class="fa fa-copy fa-lg"></i></a>`;
    },
    bSortable: false,
  };
}

const formCloneColumn = cloneColumn('forms');

const releasedFormCloneColumn = cloneColumn('released-forms');

const formShareLinkColumn = {
  sTitle: '',
  mData(source) {
    if (source.publicAccess >= 0) {
      return `<a href="${prefix}/forms/${source._id}/share/" target="${linkTarget}" data-toggle="tooltip" title="share the form" class="text-success"><i class="fa fa-users fa-lg"></i></a>`;
    }
    return `<a href="${prefix}/forms/${source._id}/share/" target="${linkTarget}" data-toggle="tooltip" title="share the form"><i class="fa fa-users fa-lg"></i></a>`;
  },
  bSortable: false,
};

const formReviewLinkColumn = {
  sTitle: '',
  mData(source) {
    return `<a href="${prefix}/forms/${source._id}/review/" target="${linkTarget}" data-toggle="tooltip" title="reviews for the form"><i class="fa fa-eye fa-lg"></i></a>`;
  },
  bSortable: false,
};

const reviewerIdColumn = personColumn('Reviewer', '_id');

const reviewRequestedOnColumn = dateColumn('Requested', 'requestedOn');

const reviewRequestedByColumn = personColumn('Requested by', 'requestedBy');

const createdOnColumn = dateColumn('Created', 'createdOn');
const createdByColumn = personColumn('Created by', 'createdBy');
const ownerColumn = {
  sTitle: 'Owner',
  sDefaultContent: '',
  mData(source, type) {
    const owner = source.owner || source.createdBy;
    if (type === 'sort' || type === 'filter') {
      return owner;
    }
    if (owner) {
      return `<a target="${linkTarget}" href="/users/${owner}"><img class="user" data-src="holder.js/27x40?size=20&text=${owner
        .substr(0, 1)
        .toUpperCase()}" src="${prefix}/adusers/${owner}/photo" title="${owner}"></a>`;
    }
    return '';
  },
  bFilter: true,
};

const clonedByColumn = personColumn('Cloned by', 'clonedBy');

const updatedOnColumn = dateColumn('Updated', 'updatedOn');
const updatedByColumn = personColumn('Updated by', 'updatedBy');

const releasedOnColumn = longDateColumn('Released', 'releasedOn');
const releasedByColumn = personColumn('Released by', 'releasedBy');

const transferredOnColumn = dateColumn('transferred', 'transferredOn');

const archivedOnColumn = dateColumn('Archived', 'archivedOn');
const archivedByColumn = personColumn('Archived by', 'archivedBy');

const deadlineColumn = dateColumn('Deadline', 'deadline');

const tagsColumn = {
  sTitle: 'Tags',
  sDefaultContent: '',
  mData(source, type, val) {
    return source.tags || [];
  },
  mRender(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data.join(' ');
    }
    return data.join('; ');
  },
  bFilter: true,
};

const keysColumn = {
  sTitle: 'Reporting IDs',
  sDefaultContent: '',
  mData(source, type, val) {
    if (source.mapping) {
      return Object.keys(source.mapping);
    }
    return [];
  },
  mRender(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data.join(' ');
    }
    return data.join('; ');
  },
  bAutoWidth: false,
  sWidth: '210px',
  bFilter: true,
};

const reviewResultColumn = {
  sTitle: 'Review result',
  sDefaultContent: '',
  mData: 'result',
  mRender(data) {
    if (!data) {
      return 'not reported';
    }
    if (data.result) {
      return 'approved';
    }
    return 'rejected';
  },
  bFilter: true,
};

const commentColumn = {
  sTitle: 'Comment',
  sDefaultContent: '',
  mData: 'comment',
  bFilter: true,
};

const titleColumn = {
  sTitle: 'Title',
  sDefaultContent: '',
  mData: 'title',
  bFilter: true,
};

const versionColumn = {
  sTitle: 'Ver',
  mData: '_v',
  sDefaultContent: '',
  bFilter: true,
  sWidth: '45px',
};

const releasedFormVersionColumn = {
  sTitle: 'Ver',
  mData: 'ver',
  sDefaultContent: '',
  bFilter: true,
  sWidth: '45px',
};

const formTypeColumn = {
  sTitle: 'Type',
  mData: 'formType',
  sDefaultContent: 'normal',
  bFilter: true,
};

function formatFormStatus(s) {
  const status = {
    '0': 'draft',
    '0.5': 'submitted for approval',
    '1': 'pre released',
    '2': 'archived',
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
}

const formStatusColumn = {
  sTitle: 'Status',
  mData(source, type, val) {
    return formatFormStatus(source.status);
  },
  bFilter: true,
};

function formatReleasedFormStatus(s) {
  const status = {
    '1': 'released',
    '2': 'archived',
  };
  if (status[s.toString()]) {
    return status[s.toString()];
  }
  return 'unknown';
}

const releasedFormStatusColumn = {
  sTitle: 'Status',
  mData(source, type, val) {
    return formatReleasedFormStatus(source.status);
  },
  bFilter: true,
};

const travelerLinkColumn = {
  sTitle: '',
  mData(source, type, val) {
    if (source.hasOwnProperty('url')) {
      return `<a href="${source.url}" data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a>`;
    }
    if (source.hasOwnProperty('_id')) {
      return `<a href="${prefix}/travelers/${source._id}/" data-toggle="tooltip" title="go to the traveler"><i class="fa fa-edit fa-lg"></i></a>`;
    }
    return 'unknown';
  },
  bSortable: false,
};

const travelerConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender(data, type, full) {
    return `<a href="${prefix}/travelers/${data}/config" data-toggle="tooltip" title="config the traveler"><i class="fa fa-gear fa-lg"></i></a>`;
  },
  bSortable: false,
};

const travelerShareLinkColumn = {
  sTitle: '',
  mData(source) {
    if (source.publicAccess >= 0) {
      return `<a href="${prefix}/travelers/${source._id}/share/" target="${linkTarget}" data-toggle="tooltip" title="share the traveler" class="text-success"><i class="fa fa-users fa-lg"></i></a>`;
    }
    return `<a href="${prefix}/travelers/${source._id}/share/" target="${linkTarget}" data-toggle="tooltip" title="share the traveler"><i class="fa fa-users fa-lg"></i></a>`;
  },
  bSortable: false,
};

const binderLinkColumn = {
  sTitle: '',
  mData(source, type, val) {
    if (source.hasOwnProperty('url')) {
      return `<a href="${source.url}" target="${linkTarget}" data-toggle="tooltip" title="go to the binder"><i class="fa fa-eye fa-lg"></i></a>`;
    }
    if (source.hasOwnProperty('_id')) {
      return `<a href="${prefix}/binders/${source._id}/" target="${linkTarget}" data-toggle="tooltip" title="go to the binder"><i class="fa fa-eye fa-lg"></i></a>`;
    }
    return 'unknown';
  },
  bSortable: false,
};

const binderConfigLinkColumn = {
  sTitle: '',
  mData: '_id',
  mRender(data, type, full) {
    return `<a href="${prefix}/binders/${data}/config" target="${linkTarget}" data-toggle="tooltip" title="config the binder"><i class="fa fa-gear fa-lg"></i></a>`;
  },
  bSortable: false,
};

const binderShareLinkColumn = {
  sTitle: '',
  mData(source) {
    if (source.publicAccess >= 0) {
      return `<a href="${prefix}/binders/${source._id}/share/" target="${linkTarget}" data-toggle="tooltip" title="share the binder" class="text-success"><i class="fa fa-users fa-lg"></i></a>`;
    }
    return `<a href="${prefix}/binders/${source._id}/share/" target="${linkTarget}" data-toggle="tooltip" title="share the binder"><i class="fa fa-users fa-lg"></i></a>`;
  },
  bSortable: false,
};

const deviceTravelerLinkColumn = {
  sTitle: '',
  mData: 'inventoryId',
  mRender(data, type, full) {
    return `<a href="${prefix}/currenttravelers/?device=${data}" data-toggle="tooltip" title="travelers for this device"><i class="fa fa-search fa-lg"></i></a>`;
  },
  bSortable: false,
};

function progressBar(active, finished, inProgress, text, width) {
  const w = width || '100px';
  const t = text || '';
  const bar = $(
    `<div class="progress" style="width: ${w};"><div class="bar bar-success" style="width:${finished}%;"></div><div class="bar bar-info" style="width:${inProgress}%;"></div><div class="progress-value">${t}</div></div>`
  );
  if (active) {
    bar.addClass('active').addClass('progress-striped');
  }
  return bar[0].outerHTML;
}

const travelerProgressColumn = {
  sTitle: 'Estimated progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '105px',
  mData(source, type) {
    if (source.status === 2) {
      if (type === 'sort') {
        return 1;
      }
      return progressBar(false, 100, 0);
    }

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

    const inProgress = Math.floor(
      (source.finishedInput / source.totalInput) * 100
    );

    return progressBar(
      source.status === 1,
      0,
      inProgress,
      `${source.finishedInput} / ${source.totalInput}`
    );
  },
};

const workProgressColumn = {
  sTitle: 'Estimated progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '210px',
  mData(source, type) {
    const w = '200px';
    if (source.status === 2) {
      if (type === 'sort') {
        return 1;
      }
      return progressBar(
        false,
        100,
        0,
        `${source.value} + 0 / ${source.value}`,
        w
      );
    }

    const { inProgress } = source;
    let finished = 0;

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
      `${Math.round(finished * source.value)} + ${Math.round(
        inProgress * source.value
      )} / ${Math.round(source.value)}`,
      w
    );
  },
};

const binderWorkProgressColumn = {
  sTitle: 'Work progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '105px',
  mData(source, type, val) {
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

    const inProgress = source.inProgressWork / source.totalWork;
    const finished = source.finishedWork / source.totalWork;

    if (type === 'sort') {
      return finished + inProgress;
    }

    return progressBar(
      source.status === 1,
      finished * 100,
      inProgress * 100,
      `${source.finishedWork} / ${source.totalWork} + ${source.finishedInput} / ${source.totalInput}`
    );
  },
};

const binderValueProgressColumn = {
  sTitle: 'Value progress',
  bSortable: true,
  sType: 'numeric',
  bAutoWidth: false,
  sWidth: '105px',
  mData(source, type, val) {
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

    const inProgress = source.inProgressValue / source.totalValue;
    const finished = source.finishedValue / source.totalValue;

    if (type === 'sort') {
      return finished + inProgress;
    }

    return progressBar(
      source.status === 1,
      finished * 100,
      inProgress * 100,
      `${Math.round(source.finishedValue)} + ${Math.round(
        source.inProgressValue
      )} / ${Math.round(source.totalValue)}`
    );
  },
};

const deviceColumn = {
  sTitle: 'Devices',
  mData(source, type, val) {
    return source.devices || [];
  },
  mRender(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data.join(' ');
    }
    return data.join('; ');
  },
  bFilter: true,
};

function usersColumn(title, prop) {
  return {
    sTitle: title,
    mData(source, type) {
      if (source[prop]) {
        if (source[prop].length === 0) {
          return '';
        }
        const names = source[prop].map(function(u) {
          if (!u._id) {
            return u;
          }
          if (type === 'filter' || type === 'sort') {
            return u.username;
          }
          return `<a target="${linkTarget}" href="/users/${u._id}"><img class="user" data-src="holder.js/27x40?size=20&text=${u._id.substr(0, 1).toUpperCase()}" src="${prefix}/adusers/${u._id}/photo" title="${u.username}"></a>`;
        });
        if (type === 'filter' || type === 'sort') {
          return names.join('; ');
        }
        return names.join(' ');
      }
      return '';
    },
    bFilter: true,
  };
}

function usersFilteredColumn(title, filter) {
  return {
    sTitle: title,
    mData(source, type) {
      const users = filter(source);
      if (users.length === 0) {
        return '';
      }
      const names = users.map(function(u) {
        if (!u._id) {
          return u;
        }
        if (type === 'filter' || type === 'sort') {
          return u.username;
        }
        return `<a target="${linkTarget}" href="/users/${u._id}"><img class="user" data-src="holder.js/27x40?size=20&text=${u._id.substr(0, 1).toUpperCase()}" src="${prefix}/adusers/${u._id}/photo" title="${u.username}"></a>`;
      });
      if (type === 'filter' || type === 'sort') {
        return names.join('; ');
      }
      return names.join(' ');
    },
    bFilter: true,
  };
}

const sharedWithColumn = usersColumn('Shared with', 'sharedWith');

function notIn(user, users) {
  let i;
  for (i = 0; i < users.length; i += 1) {
    if (users[i]._id === user._id) {
      return false;
    }
  }
  return true;
}

const manPowerColumn = usersFilteredColumn('Powered by', function(source) {
  const out = [];
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

const filledByColumn = usersColumn('Filled by', 'manPower');

const sharedGroupColumn = {
  sTitle: 'Shared groups',
  mData(source, type, val) {
    if (source.sharedGroup) {
      if (source.sharedGroup.length === 0) {
        return '';
      }
      const names = source.sharedGroup.map(function(g) {
        return g.groupname;
      });
      return names.join('; ');
    }
    return '';
  },
  bFilter: true,
};

const statusColumn = {
  sTitle: 'Status',
  mData: 'status',
  mRender(data, type, full) {
    return formatTravelerStatus(data);
  },
  bFilter: true,
};

/* shared user columns */
const useridColumn = personColumn('User', '_id');

const useridNoLinkColumn = {
  sTitle: 'User id',
  mData: '_id',
  sDefaultContent: '',
  bFilter: true,
};

const userNameColumn = {
  sTitle: 'Full name',
  mData: 'username',
  sDefaultContent: '',
  mRender(data, type, full) {
    return `<a href = "${prefix}/users?name=${data}">${data}</a>`;
  },
  bFilter: true,
};

const userNameNoLinkColumn = {
  sTitle: 'Full name',
  mData: 'username',
  sDefaultContent: '',
  bFilter: true,
};

const fullNameNoLinkColumn = {
  sTitle: 'Full name',
  mData: 'name',
  sDefaultContent: '',
  bFilter: true,
};

const groupIdColumn = {
  sTitle: 'Group id',
  mData: '_id',
  sDefaultContent: '',
  bFilter: true,
  mRender(data) {
    return `<a href="${prefix}/groups/${data}">${data}</a>`;
  },
};

const displayNameColumn = {
  sTitle: 'Display Name',
  mData: 'name',
  sDefaultContent: '',
  bFilter: true,
};

const groupNameColumn = {
  sTitle: 'Group Name',
  mData: 'groupname',
  sDefaultContent: '',
  bFilter: true,
};

const membersColumn = {
  sTitle: 'Member(s)',
  mData: 'members',
  sDefaultContent: '',
  bFilter: false,
  mRender(data) {
    data.sort(function(a, b) {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
        return 1;
      }
      return 0;
    });
    const result = data.map(function(d) {
      return `<li>${d.name}</li>`;
    });
    return `<ul>${result.join('')}</ul>`;
  },
};

const accessColumn = {
  sTitle: 'Privilege',
  mData: 'access',
  sDefaultContent: '',
  mRender(data, type, full) {
    if (data === 0) {
      return 'read';
    }
    if (data === 1) {
      return 'write';
    }
    return 'unknown';
  },
  bFilter: true,
};

/* user columns */
const rolesColumn = {
  sTitle: 'Roles',
  mData: 'roles',
  sDefaultContent: '',
  mRender(data, type, full) {
    return data.join();
  },
  bFilter: true,
};

const lastVisitedOnColumn = dateColumn('Last visited', 'lastVisitedOn');

/* device columns */

const serialColumn = {
  sTitle: 'Serial',
  mData: 'inventoryId',
  sDefaultContent: '',
  bFilter: true,
};

const typeColumn = {
  sTitle: 'Type',
  mData: 'deviceType.name',
  sDefaultContent: '',
  bFilter: true,
};

const descriptionColumn = {
  sTitle: 'Description',
  mData: 'deviceType.description',
  sDefaultContent: '',
  bFilter: true,
};

const modifiedOnColumn = dateColumn('Modified', 'dateModified');

const modifiedByColumn = {
  sTitle: 'Modified by',
  mData: 'modifiedBy',
  sDefaultContent: '',
  bFilter: true,
};

const addedByColumn = personColumn('Added by', 'addedBy');

const addedOnColumn = dateColumn('Added on', 'addedOn');

const sequenceColumn = {
  sTitle: 'Sequence',
  mData: 'sequence',
  sClass: 'editable',
  sType: 'numeric',
  bFilter: true,
  mRender(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data;
    }
    return `<input type="number" min=1 step=1 class="input-mini config" value="${data}">`;
  },
};

const sColumn = {
  sTitle: 'S',
  mData: 'sequence',
  bFilter: true,
};

const priorityColumn = {
  sTitle: 'Priority',
  mData: 'priority',
  sClass: 'editable',
  sType: 'numeric',
  bFilter: true,
  mRender(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data;
    }
    return `<input type="number" min=1 step=1 class="input-mini config" value="${data}">`;
  },
};

const pColumn = {
  sTitle: 'P',
  mData: 'priority',
  bFilter: true,
};

const valueColumn = {
  sTitle: 'Value',
  mData: 'value',
  sClass: 'editable',
  sType: 'numeric',
  bFilter: true,
  mRender(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data;
    }
    return `<input type="number" min=0 class="input-mini config" value="${data}">`;
  },
};

const vColumn = {
  sTitle: 'V',
  mData: 'value',
  bFilter: true,
};

const colorColumn = {
  sTitle: 'Color',
  mData: 'color',
  sClass: 'editable',
  mRender(data, type) {
    if (type === 'sort' || type === 'filter') {
      return data;
    }
    const snippet = $(
      '<select name="select" class="input-small config"><option value = "blue" class="text-info">blue</option><option value = "green" class="text-success">green</option><option value = "yellow" class="text-warning">yellow</option><option value = "red" class="text-error">red</option><option value = "black">black</option></select>'
    );
    $(`option[value="${data}"]`, snippet).attr('selected', 'selected');
    return snippet[0].outerHTML;
  },
};

const cColumn = {
  sTitle: 'C',
  mData: 'color',
  mRender(data, type) {
    const snippet = $('<i class="fa fa-flag fa-lg"></i>');
    if (type === 'sort' || type === 'filter') {
      return data;
    }
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

const oTableTools = {
  sSwfPath: prefix
    ? `${prefix}/datatables/swf/copy_csv_xls_pdf.swf`
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

const sDom =
  "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";
const sDom2i =
  "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span3'l><'span3'i><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>";
const sDom2i1p =
  "<'row-fluid'<'span6'<'control-group'T>>><'row-fluid'<'span3'l><'span3'i><'span3'r><'span3'f>>t<'row-fluid'<'span6'i><'span6'p>>";
const sDomNoTools =
  "<'row-fluid'<'span4'l><'span4'<'text-center'r>><'span4'f>>t<'row-fluid'<'span6'i><'span6'p>>";
const sDomNoTNoR = "t<'row-fluid'<'span6'i><'span6'p>>";
const sDomClean = 't';
const sDomPage = "<'row-fluid'r>t<'row-fluid'<'span6'i><'span6'p>>";

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
    const api = new jQuery.fn.dataTable.Api(oSettings);

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
  const that = this;
  const iStart = oSettings._iDisplayStart;
  const aData = [];

  this.oApi._fnServerParams(oSettings, aData);

  oSettings.fnServerData.call(
    oSettings.oInstance,
    oSettings.sAjaxSource,
    aData,
    function(json) {
      /* Clear the old information from the table */
      that.oApi._fnClearTable(oSettings);

      /* Got the data - add it to the table */
      const dataArray =
        oSettings.sAjaxDataProp !== ''
          ? that.oApi._fnGetObjectDataFn(oSettings.sAjaxDataProp)(json)
          : json;
      let i;
      for (i = 0; i < dataArray.length; i += 1) {
        that.oApi._fnAddData(oSettings, dataArray[i]);
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
      if (typeof fnCallback === 'function' && fnCallback !== null) {
        fnCallback(oSettings);
      }
    },
    oSettings
  );
};
