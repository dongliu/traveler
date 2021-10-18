/* global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false, travelerGlobal: false, Holder, moment */
/* global selectColumn: false, reviewerIdColumn, fnGetSelected: false, selectEvent: false, filterEvent: false, sDomNoTools: false, reviewResultColumn */

const path = window.location.pathname;

function transformReview(review) {
  const reviews = [];
  const { reviewers = [], reviewResults = [] } = review;
  reviewers.forEach(reviewer => {
    const result = {
      _id: reviewer,
      result: reviewResults.find(reviewResult => reviewResult._id === reviewer),
    };
    reviews.push(result);
  });
  return reviews;
}

function initTable(list, oTable) {
  $.ajax({
    url: `${path}json`,
    type: 'GET',
    dataType: 'json',
  })
    .done(function(json) {
      oTable.fnClearTable();
      const reviews = transformReview(json);
      oTable.fnAddData(reviews);
      oTable.fnDraw();
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for review information.</div>'
        );
      }
    });
}

function removeFromModal(list, cb) {
  const ids = [];
  $('#modal .modal-body .target').each(function() {
    ids.push(this.id);
  });
  $.ajax({
    url: `${path + list}/${ids.join()}`,
    type: 'DELETE',
    dataType: 'json',
  })
    .done(function(json) {
      json.forEach(function(id) {
        let item;
        if (list === 'users') {
          item = $(`#${id}`);
        } else if (list === 'groups') {
          item = $(`[title="${encodeURIComponent(id)}"]`);
        } else {
          return;
        }
        item.wrap('<del></del>');
        item.addClass('text-success');
      });
    })
    .fail(function(jqXHR) {
      $('.modal-body').append(`Error : ${jqXHR.responseText}`);
    })
    .always(function() {
      cb();
    });
}

function remove(list, oTable) {
  const selected = fnGetSelected(oTable, 'row-selected');
  if (selected.length) {
    $('#modalLabel').html(`Remove the following ${selected.length} ${list}? `);
    $('#modal .modal-body').empty();
    selected.forEach(function(row) {
      const data = oTable.fnGetData(row);
      if (list === 'users') {
        $('#modal .modal-body').append(
          `<div class="target" id="${data._id}">${data.username}</div>`
        );
      }
      if (list === 'groups') {
        $('#modal .modal-body').append(
          `<div class="target" id="${encodeURIComponent(
            data._id
          )}" title="${encodeURIComponent(data._id)}">${data.groupname}</div>`
        );
      }
    });
    $('#modal .modal-footer').html(
      '<button id="remove" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#remove').click(function(e) {
      e.preventDefault();
      $('#remove').prop('disabled', true);
      removeFromModal(list, function() {
        initTable(list, oTable);
      });
    });
    $('#modal').modal('show');
  } else {
    $('#modalLabel').html('Alert');
    $('#modal .modal-body').html('No item has been selected!');
    $('#modal .modal-footer').html(
      '<button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modal').modal('show');
  }
}

function inArray(name, ao) {
  let i;
  for (i = 0; i < ao.length; i += 1) {
    if ((ao[i].username || ao[i]._id) === name) {
      return true;
    }
  }
  return false;
}

function addTo(data, table, list) {
  if (!data.name) {
    $('#message').append(
      `<div class="alert"><button class="close" data-dismiss="alert">x</button>${list} name is empty. </div>`
    );
    return;
  }
  if (inArray(data.name, table.fnGetData())) {
    const { name } = data;
    // show message
    $('#message').append(
      `<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button><strong>${name}</strong> is already in the review list. </div>`
    );
    return;
  }
  $.ajax({
    url: `${path}reviewer`,
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(data),
    processData: false,
    success(res, status, jqXHR) {
      $('#message').append(
        `<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>${jqXHR.responseText}</div>`
      );
      initTable(list, table);
    },
    error(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          `<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the review list : ${jqXHR.responseText}</div>`
        );
      }
    },
  });
}

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });

  if ($('#username').length) {
    travelerGlobal.usernames.initialize();
  }

  $('#username').typeahead(
    {
      minLength: 1,
      highlight: true,
      hint: true,
    },
    {
      name: 'usernames',
      display: 'displayName',
      limit: 20,
      source: travelerGlobal.usernames,
    }
  );

  $('#username').on('typeahead:select', function() {
    $('#add').attr('disabled', false);
  });

  const reviewAoColumns = [selectColumn, reviewerIdColumn, reviewResultColumn];
  const reviewTable = $('#review-table').dataTable({
    aaData: [],
    aoColumns: reviewAoColumns,
    fnDrawCallback() {
      Holder.run({
        images: 'img.user',
      });
    },
    aaSorting: [[1, 'desc']],
    sDom: sDomNoTools,
  });

  selectEvent();
  filterEvent();

  $('#add').click(function(e) {
    e.preventDefault();
    const data = {};
    data.name = $('#username').val();
    addTo(data, reviewTable, 'users');
    // document.forms[0].reset();
    $('form[name="user"]')[0].reset();
  });

  $('#review-remove').click(function() {
    remove('users', reviewTable);
  });

  if ($('#username').length) {
    initTable('users', reviewTable);
  }
});
