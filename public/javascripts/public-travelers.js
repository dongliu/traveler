/*global window: false */
/*global prefix: false, linkTarget: false, moment: false, updateAjaxURL: false, disableAjaxCache: false*/
/*global selectColumn: false, fnGetSelected: false, selectEvent: false*/

/**
 * The public travelers dashboard. All the data comes from
 * GET /publictravelers/list, which pages, filters, and orders on the server.
 * The DataTable is only a container for the rows of the current page (paging,
 * searching, and sorting are off), so the shared row-selection helpers and the
 * binder modal keep working.
 */

import * as AddBinder from './lib/binder.js';

const ARCHIVED_COLUMN = 14;

const STATUS_COLORS = {
  initialized: '#999999',
  active: '#3a87ad',
  'submitted for completion': '#f89406',
  completed: '#468847',
  frozen: '#5bc0de',
  archived: '#555555',
};

const TEXT_FILTERS = {
  updatedFrom: '#f-updated-from',
  updatedTo: '#f-updated-to',
  subsystem: '#f-subsystem',
  device: '#f-device',
  activity: '#f-activity',
  machineArea: '#f-machine-area',
  sector: '#f-sector',
  windchillId: '#f-windchill-id',
  tags: '#f-tags',
};

// the statuses in the order their cards are shown; the archived card appears
// only while archived travelers are included
const STATUS_ORDER = [
  'initialized',
  'active',
  'submitted for completion',
  'completed',
  'frozen',
  'archived',
];
const ALL_COLOR = '#666666';

// what is shown for a value that does not exist
const NONE = '—';

// the state of the list: which page, how many per page, and which request is
// the latest, so that a slow answer to an older request is ignored
const state = { page: 1, limit: 25, status: '', requestId: 0 };

// The records hold text that people typed (titles, tags, and so on), and the
// table inserts what a column returns as HTML, so every such value is escaped.
function escapeHtml(value) {
  return $('<div></div>')
    .text(value === null || value === undefined ? '' : String(value))
    .html();
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function dateText(value) {
  if (!value) {
    return '';
  }
  const when = moment(value);
  return `<span title="${escapeAttribute(
    when.format('YYYY-MM-DD HH:mm:ss')
  )}">${escapeHtml(when.fromNow())}</span>`;
}

function personAndDate(person, value) {
  const by = escapeHtml(person);
  const on = dateText(value);
  if (!by && !on) {
    return NONE;
  }
  return `${by}<br><small class="muted">${on || NONE}</small>`;
}

function progressText(record) {
  const total = Number(record.totalInput) || 0;
  if (total === 0) {
    return NONE;
  }
  const finished = Math.min(Number(record.finishedInput) || 0, total);
  const percent = Math.round((finished / total) * 100);
  return `<div class="progress" title="${percent}%"><div class="bar" style="width:${percent}%"></div></div><small>${finished}/${total}</small>`;
}

function textColumn(title, key) {
  return {
    sTitle: title,
    mData: key,
    sDefaultContent: '',
    mRender(data, type) {
      return type === 'display' ? escapeHtml(data) : data;
    },
  };
}

const columns = [
  selectColumn,
  {
    sTitle: 'Title',
    mData: 'title',
    sDefaultContent: '',
    mRender(data, type, full) {
      if (type !== 'display') {
        return data;
      }
      return `<a href="${prefix}/travelers/${escapeAttribute(
        full._id
      )}/" target="${escapeAttribute(linkTarget)}">${escapeHtml(data) ||
        '(no title)'}</a>`;
    },
  },
  {
    sTitle: 'Status',
    mData: 'status',
    sDefaultContent: '',
    mRender(data, type) {
      if (type !== 'display') {
        return data;
      }
      return `<span class="label" style="background:${STATUS_COLORS[data] ||
        '#999999'}">${escapeHtml(data)}</span>`;
    },
  },
  {
    sTitle: 'Progress',
    sDefaultContent: '',
    sWidth: '90px',
    mData(source, type) {
      return type === 'display' ? progressText(source) : source.finishedInput;
    },
  },
  textColumn('Subsystem', 'subsystem'),
  textColumn('Device', 'device'),
  textColumn('Activity', 'activity'),
  textColumn('Machine area', 'machineArea'),
  textColumn('Sector', 'sector'),
  textColumn('Windchill ID', 'windchillId'),
  {
    sTitle: 'Tags',
    mData: 'tags',
    sDefaultContent: '',
    mRender(data, type) {
      const tags = Array.isArray(data) ? data : [];
      return type === 'display'
        ? tags.map(escapeHtml).join('; ')
        : tags.join(' ');
    },
  },
  textColumn('Owner', 'owner'),
  {
    sTitle: 'Created',
    mData: 'createdOn',
    sDefaultContent: '',
    mRender(data, type, full) {
      return type === 'display' ? personAndDate(full.createdBy, data) : data;
    },
  },
  {
    sTitle: 'Updated',
    mData: 'updatedOn',
    sDefaultContent: '',
    mRender(data, type, full) {
      return type === 'display' ? personAndDate(full.updatedBy, data) : data;
    },
  },
  {
    sTitle: 'Archived',
    mData: 'archivedOn',
    sDefaultContent: '',
    bVisible: false,
    mRender(data, type) {
      return type === 'display' ? dateText(data) || NONE : data;
    },
  },
];

function noneSelectedModal() {
  $('#modalLabel').html('Alert');
  $('#modal .modal-body').html('No traveler has been selected!');
  $('#modal .modal-footer').html(
    '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
  );
  $('#modal').modal('show');
}

// the query for the current filters, without paging
function filterParams() {
  const params = {};
  Object.keys(TEXT_FILTERS).forEach(function addFilter(name) {
    const value = String($(TEXT_FILTERS[name]).val() || '').trim();
    if (value) {
      params[name] = value;
    }
  });
  if ($('#f-include-archived').is(':checked')) {
    params.includeArchived = 'true';
  }
  if (state.status) {
    params.status = state.status;
  }
  return params;
}

function setLoading(loading) {
  $('#loading').toggle(loading);
  $('#public-travelers-table').css('opacity', loading ? 0.5 : 1);
}

function clearMessage() {
  $('#message').empty();
}

function showError(xhr, textStatus) {
  let message;
  let retry = true;
  if (xhr.status === 400 && xhr.responseJSON && xhr.responseJSON.error) {
    // the request itself is wrong, so trying it again would not help
    message = xhr.responseJSON.error;
    retry = false;
  } else if (xhr.status === 401 || textStatus === 'parsererror') {
    message =
      'Your session may have expired. Please sign in again, then retry.';
  } else {
    message = 'The list of travelers could not be loaded.';
  }
  const alertBox = $('<div class="alert alert-error"></div>');
  if (!retry) {
    alertBox.append(
      '<button type="button" class="close" data-dismiss="alert">&times;</button>'
    );
  }
  alertBox.append($('<span></span>').text(`${message} `));
  if (retry) {
    alertBox.append(
      '<button type="button" class="btn btn-small" id="retry-load">Retry</button>'
    );
  }
  $('#message')
    .empty()
    .append(alertBox);
}

function addCard(container, value, label, count) {
  const card = $('<button type="button" class="status-card"></button>')
    .attr('data-status', value)
    .attr('aria-pressed', state.status === value ? 'true' : 'false')
    .css('background', value ? STATUS_COLORS[value] : ALL_COLOR)
    .toggleClass('active', state.status === value);
  card.append($('<span></span>').text(label));
  card.append($('<span class="count"></span>').text(count));
  container.append(card);
}

// One card per status plus one for all of them. The counts are for every
// filter except the status, so they do not change when a status is selected,
// and the "All" count is their sum.
function renderCards(statusCounts) {
  const counts = statusCounts || {};
  const container = $('#status-summary').empty();
  const names = STATUS_ORDER.filter(function present(name) {
    return Object.prototype.hasOwnProperty.call(counts, name);
  });
  let all = 0;
  names.forEach(function add(name) {
    all += counts[name];
  });
  addCard(container, '', 'All', all);
  names.forEach(function card(name) {
    addCard(container, name, name, counts[name]);
  });
}

function rangeText(data) {
  if (data.total === 0) {
    return '0 travelers';
  }
  if (data.travelers.length === 0) {
    return `No travelers on this page (${data.total} in all)`;
  }
  const start = (data.page - 1) * data.limit + 1;
  return `${start}–${start + data.travelers.length - 1} of ${data.total}`;
}

$(function() {
  updateAjaxURL(prefix);
  disableAjaxCache();

  const table = $('#public-travelers-table').dataTable({
    aoColumns: columns,
    bPaginate: false,
    bFilter: false,
    bSort: false,
    bInfo: false,
    bAutoWidth: false,
    sDom: 't',
    oLanguage: {
      sEmptyTable: 'No public travelers match the current filters.',
    },
  });

  function render(data) {
    table.fnClearTable(false);
    if (data.travelers.length > 0) {
      table.fnAddData(data.travelers, false);
    }
    table.fnDraw();
    state.page = data.page;
    renderCards(data.statusCounts);
    $('#range-info').text(rangeText(data));
    $('#prev-page').prop('disabled', data.page <= 1);
    $('#next-page').prop('disabled', data.page * data.limit >= data.total);
  }

  function load() {
    state.requestId += 1;
    const requestId = state.requestId;
    const query = Object.assign({}, filterParams(), {
      page: state.page,
      limit: state.limit,
    });
    setLoading(true);
    return $.getJSON(`/publictravelers/list?${$.param(query)}`)
      .done(function show(data) {
        // a newer request has been made since, so this answer is out of date
        if (requestId !== state.requestId) {
          return;
        }
        clearMessage();
        render(data);
      })
      .fail(function fail(xhr, textStatus) {
        if (requestId === state.requestId) {
          showError(xhr, textStatus);
        }
      })
      .always(function done() {
        if (requestId === state.requestId) {
          setLoading(false);
        }
      });
  }

  function clearFilters() {
    Object.keys(TEXT_FILTERS).forEach(function empty(name) {
      $(TEXT_FILTERS[name]).val('');
    });
    $('#f-include-archived').prop('checked', false);
    table.fnSetColumnVis(ARCHIVED_COLUMN, false, false);
    state.status = '';
    state.page = 1;
    load();
  }

  $('#apply-filters').on('click', function() {
    state.page = 1;
    load();
  });
  $('#clear-filters').on('click', clearFilters);
  $('.filter-bar input[type=text], .filter-bar input[type=date]').on(
    'keydown',
    function(e) {
      if (e.which === 13) {
        e.preventDefault();
        $('#apply-filters').trigger('click');
      }
    }
  );
  $('#f-include-archived').on('change', function() {
    const included = $(this).is(':checked');
    table.fnSetColumnVis(ARCHIVED_COLUMN, included, false);
    // the archived card goes with the archived travelers, so drop a selection of it
    if (!included && state.status === 'archived') {
      state.status = '';
    }
    state.page = 1;
    load();
  });
  $('#page-size').on('change', function() {
    state.limit = Number($(this).val());
    state.page = 1;
    load();
  });
  $('#prev-page').on('click', function() {
    if (state.page > 1) {
      state.page -= 1;
      load();
    }
  });
  $('#next-page').on('click', function() {
    if (!$(this).prop('disabled')) {
      state.page += 1;
      load();
    }
  });
  $('#status-summary').on('click', '.status-card', function() {
    const value = $(this).attr('data-status');
    // "All", or the card that is already selected, shows every status again
    state.status = value === state.status ? '' : value;
    state.page = 1;
    load();
  });
  $('#message').on('click', '#retry-load', function() {
    load();
  });

  $('#download-csv').on('click', function() {
    // no page or limit, so the file holds every traveler that matches
    const query = $.param(Object.assign({ format: 'csv' }, filterParams()));
    window.location.href = `${prefix}/publictravelers/list?${query}`;
  });

  $('#report').on('click', function() {
    const selected = fnGetSelected(table, 'row-selected');
    if (selected.length === 0) {
      noneSelectedModal();
      return;
    }
    $('#report-form').empty();
    selected.forEach(function addTraveler(row) {
      const data = table.fnGetData(row);
      $('#report-form').append(
        $('<input type="hidden"/>').attr({
          name: 'travelers[]',
          value: data._id,
        })
      );
    });
    $('#report-form').trigger('submit');
  });

  $('#add-to-binder').on('click', function() {
    AddBinder.addModal(table);
  });

  // binding events
  selectEvent();

  load();
});
