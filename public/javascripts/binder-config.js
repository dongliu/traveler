/*eslint max-nested-callbacks: [2, 4]*/

/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global removeColumn, sequenceColumn, colorColumn, priorityColumn, valueColumn, travelerLinkColumn, aliasColumn, addedByColumn, addedOnColumn, ownerColumn, deviceColumn, tagsColumn, sharedWithColumn, sharedGroupColumn, sDomNoTools*/
/*global moment: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix: false, Holder*/

function cleanTagForm() {
  $('#new-tag')
    .closest('li')
    .remove();
  $('#add-tag').prop('disabled', false);
}

function setStatus(s) {
  $.ajax({
    url: './status',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
      status: s,
    }),
  })
    .done(function() {
      // TODO: avoid refresh the whole page
      document.location.href = window.location.pathname;
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' +
            jqXHR.responseText +
            '</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}

function changeEvents() {
  $('input.config, select.config').change(function() {
    $(this).addClass('input-changed');
    $(this).css({
      border: '1px solid #c09853',
      'box-shadow': '0 0 5px rgba(192, 152, 83, 1)',
    });
    if ($('#save').prop('disabled')) {
      $('#save').prop('disabled', false);
    }
  });
}

function tagEvents() {
  $('#add-tag').click(function(e) {
    e.preventDefault();
    // add an input and a button add
    $('#add-tag').prop('disabled', true);
    $('#tags').append(
      '<li><form class="form-inline"><input id="new-tag" type="text"> <button id="confirm" class="btn btn-primary">Confirm</button> <button id="cancel" class="btn">Cancel</button></form></li>'
    );
    $('#cancel').click(function(cancelE) {
      cancelE.preventDefault();
      cleanTagForm();
    });

    $('#confirm').click(function(confirmE) {
      var newTag = $('#new-tag')
        .val()
        .trim();
      confirmE.preventDefault();
      if (newTag) {
        $.ajax({
          url: './tags/',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            newtag: newTag,
          }),
        })
          .done(function() {
            $('#tags').append(
              '<li><span class="tag">' +
                newTag +
                '</span> <button class="btn btn-small btn-warning remove-tag"><i class="fa fa-trash-o fa-lg"></i></button></li>'
            );
          })
          .fail(function(jqXHR) {
            if (jqXHR.status !== 401) {
              $('#message').append(
                '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot add the tag</div>'
              );
              $(window).scrollTop(
                $('#message div:last-child').offset().top - 40
              );
            }
          })
          .always(function() {
            cleanTagForm();
          });
      }
    });
  });

  $('#tags').on('click', '.remove-tag', function(e) {
    e.preventDefault();
    var $that = $(this);
    $.ajax({
      url: './tags/' + encodeURIComponent($that.siblings('span.tag').text()),
      type: 'DELETE',
    })
      .done(function() {
        $that.closest('li').remove();
      })
      .fail(function(jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot remove the tag</div>'
          );
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      });
  });
}

function editEvents(initValue) {
  $('span.editable').editable(
    function(value) {
      var that = this;
      if (value === initValue[that.id]) {
        return value;
      }
      var data = {};
      data[that.id] = value;
      $.ajax({
        url: './config',
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function() {
          initValue[that.id] = value;
        },
        error: function(jqXHR) {
          $(that).text(initValue[that.id]);
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the binder config : ' +
              jqXHR.responseText +
              '</div>'
          );
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        },
      });
      return value;
    },
    {
      type: 'textarea',
      rows: 1,
      cols: 120,
      style: 'display: inline',
      cancel: 'Cancel',
      submit: 'Update',
      indicator: 'Updating...',
      tooltip: 'Click to edit...',
    }
  );

  $('button.editable').click(function() {
    $(this)
      .siblings('span.editable')
      .first()
      .click();
  });
}

function removeWork(id, cb) {
  $.ajax({
    url: './works/' + id,
    type: 'DELETE',
  })
    .done(function() {
      $('#' + id).wrap('<del></del>');
      $('#' + id).addClass('text-success');
      cb(null);
    })
    .fail(function(jqXHR, status, error) {
      $('#' + id).append(' : ' + jqXHR.responseText);
      $('#' + id).addClass('text-error');
      cb(error);
    });
}

function updateWorks(updates, cb) {
  $.ajax({
    url: './works/',
    type: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify(updates),
  })
    .done(function(data, status, jqXHR) {
      var timestamp = jqXHR.getResponseHeader('Date');
      timestamp = livespan(timestamp);
      var updateMsg =
        '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Works updated ' +
        timestamp +
        '</div>';

      $('#message').append(updateMsg);
      if (jqXHR.status !== 204) {
        cb(null, data);
      }
    })
    .fail(function(jqXHR, status, error) {
      $('#message').append(
        '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the works: ' +
          jqXHR.responseText +
          '</div>'
      );
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
      cb(error);
    });
}

function getUpdate(element, updates, table) {
  var td = element.parentNode;
  var workData = table.fnGetData(td.parentNode);
  var workID = workData._id;
  var aoColumns = table.fnSettings().aoColumns;
  var columnDef = aoColumns[table.fnGetPosition(td)[2]];
  var property = columnDef.mData;
  var oldValue = table.fnGetData(td);
  var newValue;
  if (columnDef.sType === 'numeric') {
    newValue = Number($(element).val());
  } else {
    newValue = $(element).val();
  }
  if (newValue !== oldValue) {
    if (!updates[workID]) {
      updates[workID] = {};
    }
    updates[workID][property] = newValue;
  }
}

$(function() {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  $.livestamp.interval(30 * 1000);

  $('#save').prop('disabled', true);

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });
  var initValue = {
    title: $('#title').text(),
    description: $('#description').text(),
  };

  var workAoColumns = [
    removeColumn,
    sequenceColumn,
    priorityColumn,
    valueColumn,
    colorColumn,
    travelerLinkColumn,
    aliasColumn,
    addedByColumn,
    addedOnColumn,
    ownerColumn,
    deviceColumn,
    tagsColumn,
    sharedWithColumn,
    sharedGroupColumn,
  ];

  var works;

  var worksTable = $('#work-table').dataTable({
    sAjaxSource: './works/json',
    sAjaxDataProp: 'works',
    bAutoWidth: false,
    bPaginate: false,
    iDisplayLength: 10,
    aLengthMenu: [[10, -1], [10, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: workAoColumns,
    fnInitComplete: function() {
      Holder.run({
        images: 'img.user',
      });
      works = worksTable.fnGetData();
      changeEvents();
    },
    aaSorting: [[1, 'asc'], [2, 'asc']],
    sDom: sDomNoTools,
  });

  $('#work-table').on('click', 'a.remove', function() {
    $('#modalLabel').html('Remove the following work from this binder?');
    $('#modal .modal-body').empty();
    var row = $(this).closest('tr')[0];
    var data = worksTable.fnGetData(row);
    $('#modal .modal-body').append(
      '<div class="target" id="' +
        data._id +
        '"><b>' +
        data.alias +
        '</b>, added ' +
        moment(data.addedOn).fromNow() +
        '</div>'
    );
    $('#modal .modal-footer').html(
      '<button id="remove" class="btn btn-primary">Confirm</button><button id="return" data-dismiss="modal" aria-hidden="true" class="btn">Return</button>'
    );
    $('#modal').modal('show');
    $('#remove').click(function() {
      $('#remove').prop('disabled', true);
      removeWork(data._id, function(err) {
        if (!err) {
          worksTable.fnDeleteRow(row);
        }
      });
    });
  });

  $('#active').click(function() {
    setStatus(1);
  });

  $('#complete').click(function() {
    setStatus(2);
  });

  $('#more').click(function() {
    setStatus(1);
  });

  $('#save').click(function() {
    $('#save').prop('disabled', true);
    var updates = {};
    $('input.input-changed, select.input-changed').each(function(
      index,
      element
    ) {
      getUpdate(element, updates, worksTable);
    });

    if (!$.isEmptyObject(updates)) {
      updateWorks(updates, function(err, data) {
        if (!err) {
          data.forEach(function(newW) {
            works.forEach(function(w) {
              if (newW._id === w._id) {
                w.sequence = newW.sequence;
                w.priority = newW.priority;
                w.value = newW.value;
                w.color = newW.color;
              }
            });
          });

          worksTable.fnClearTable();
          worksTable.fnAddData(works);
          changeEvents();
        }
      });
    }
  });

  editEvents(initValue);

  tagEvents();
});
