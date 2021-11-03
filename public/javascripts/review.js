/* global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false, travelerGlobal: false, Holder, moment */
/* global selectColumn: false, reviewerIdColumn, fnGetSelected: false, selectEvent: false, filterEvent: false, sDomNoTools: false, reviewResultColumn, requestedOnColumn */

const path = window.location.pathname;

function transformReview(review) {
  const reviews = [];
  const { reviewRequests = [], reviewResults = [] } = review;
  reviewRequests.forEach(reviewRequest => {
    const transformed = {
      _id: reviewRequest._id,
      requestedOn: reviewRequest.requestedOn,
      requestedBy: reviewRequest.requestedBy,
      result: reviewResults.reverse().find(reviewResult => {
        return reviewResult.reviewerId === reviewRequest._id;
      }),
    };
    reviews.push(transformed);
  });
  return reviews;
}

function initTable(oTable) {
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

function removeFromModal(cb) {
  const ids = [];
  $('#modal .modal-body .target').each(function() {
    ids.push(this.id);
  });
  $.ajax({
    url: `${path}requests/${ids.join()}`,
    type: 'DELETE',
    dataType: 'json',
  })
    .done(function(json) {
      json.forEach(function(id) {
        const item = $(`#${id}`);
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

function remove(oTable) {
  const selected = fnGetSelected(oTable, 'row-selected');
  if (selected.length) {
    $('#modalLabel').html(
      `Remove the following ${selected.length} review requests? `
    );
    $('#modal .modal-body').empty();
    selected.forEach(function(row) {
      const data = oTable.fnGetData(row);
      $('#modal .modal-body').append(
        `<div class="target" id="${data._id}">${data._id}</div>`
      );
    });
    $('#modal .modal-footer').html(
      '<button id="remove" class="btn btn-primary">Confirm</button><button data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#remove').click(function(e) {
      e.preventDefault();
      $('#remove').prop('disabled', true);
      removeFromModal(function() {
        initTable(oTable);
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
    url: `${path}requests`,
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(data),
    processData: false,
    success(res, status, jqXHR) {
      $('#message').append(
        `<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>${jqXHR.responseText}</div>`
      );
      initTable(table);
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
    if ($(this).text()) {
      $(this).text(
        moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
      );
    }
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

  const reviewAoColumns = [
    selectColumn,
    reviewerIdColumn,
    requestedOnColumn,
    reviewResultColumn,
  ];
  const reviewTable = $('#review-table').dataTable({
    aaData: [],
    aoColumns: reviewAoColumns,
    fnDrawCallback() {
      Holder.run({
        images: 'img.user',
      });
    },
    aaSorting: [[2, 'desc']],
    sDom: sDomNoTools,
  });

  selectEvent();
  filterEvent();

  $('#add').click(function(e) {
    e.preventDefault();
    const data = {};
    data.name = $('#username').val();
    addTo(data, reviewTable, 'users');
    $('form[name="user"]')[0].reset();
  });

  $('#review-remove').click(function() {
    remove(reviewTable);
  });

  if ($('#username').length) {
    initTable(reviewTable);
  }
});
