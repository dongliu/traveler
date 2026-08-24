/*global updateAjaxURL: false, prefix: false*/

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function showWbsMessage(kind, text) {
  $('#wbs-notifications-message').html(
    '<div class="alert alert-' + kind + '"><button class="close" data-dismiss="alert">x</button>' +
      escapeHtml(text) +
      '</div>'
  );
}

function wbsRowHtml(entry) {
  return (
    '<tr data-wbs-number="' + escapeHtml(entry.wbs_number) + '">' +
    '<td>' + escapeHtml(entry.wbs_number) + '</td>' +
    '<td class="wbs-email-cell">' + escapeHtml(entry.notification_email) + '</td>' +
    '<td>' + escapeHtml(entry.updated_by_name || entry.updated_by || '—') + '</td>' +
    '<td>' +
    '<button type="button" class="btn btn-sm btn-info wbs-edit-btn"><i class="fa fa-pencil"></i> Edit</button>' +
    ' <button type="button" class="btn btn-sm btn-danger wbs-remove-btn"><i class="fa fa-trash"></i> Remove</button>' +
    '</td></tr>'
  );
}

function renderWbsTable(entries) {
  var $tbody = $('#wbs-notifications-tbody');
  $tbody.empty();
  if (!entries.length) {
    $tbody.append('<tr class="wbs-notifications-empty"><td colspan="4">No WBS numbers in the registry yet.</td></tr>');
    return;
  }
  entries.forEach(function (entry) {
    $tbody.append(wbsRowHtml(entry));
  });
}

function loadWbsNotifications() {
  $.ajax({
    url: '/api/wbs-notifications',
    method: 'GET',
    success: function (data) {
      renderWbsTable(data.entries || []);
    },
    error: function (jqXHR) {
      var resp = jqXHR.responseJSON || {};
      showWbsMessage('error', resp.message || 'Failed to load the WBS Notification registry.');
    },
  });
}

$(function () {
  updateAjaxURL(prefix);

  loadWbsNotifications();

  $('#wbs-notifications-add-form').on('submit', function (e) {
    e.preventDefault();
    var wbsNumber = $('#wbs-number').val().trim();
    var email = $('#wbs-notification-email').val().trim();

    $.ajax({
      url: '/api/wbs-notifications',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ wbs_number: wbsNumber, notification_email: email }),
      success: function () {
        showWbsMessage('success', 'WBS number ' + wbsNumber + ' added to the registry.');
        $('#wbs-notifications-add-form')[0].reset();
        loadWbsNotifications();
      },
      error: function (jqXHR) {
        var resp = jqXHR.responseJSON || {};
        var msg = resp.message || 'Failed to add the WBS number.';
        if (resp.details) {
          msg += ' — ' + Object.keys(resp.details).map(function (k) {
            return resp.details[k].join(', ');
          }).join('; ');
        }
        showWbsMessage('error', msg);
      },
    });
  });

  $('#wbs-notifications-tbody').on('click', '.wbs-edit-btn', function () {
    var $row = $(this).closest('tr');
    var wbsNumber = $row.data('wbs-number');
    var $emailCell = $row.find('.wbs-email-cell');
    var currentEmail = $emailCell.text();

    $emailCell.html(
      '<input type="email" class="wbs-edit-email input-medium" value="' + escapeHtml(currentEmail) + '">' +
      ' <button type="button" class="btn btn-sm btn-primary wbs-save-btn">Save</button>' +
      ' <button type="button" class="btn btn-sm wbs-cancel-btn">Cancel</button>'
    );

    $emailCell.find('.wbs-cancel-btn').on('click', function () {
      loadWbsNotifications();
    });

    $emailCell.find('.wbs-save-btn').on('click', function () {
      var newEmail = $emailCell.find('.wbs-edit-email').val().trim();
      $.ajax({
        url: '/api/wbs-notifications/' + encodeURIComponent(wbsNumber),
        method: 'PATCH',
        contentType: 'application/json',
        data: JSON.stringify({ notification_email: newEmail }),
        success: function () {
          showWbsMessage('success', 'Notification email updated for ' + wbsNumber + '.');
          loadWbsNotifications();
        },
        error: function (jqXHR) {
          var resp = jqXHR.responseJSON || {};
          showWbsMessage('error', resp.message || 'Failed to update the notification email.');
        },
      });
    });
  });

  $('#wbs-notifications-tbody').on('click', '.wbs-remove-btn', function () {
    var $row = $(this).closest('tr');
    var wbsNumber = $row.data('wbs-number');
    if (!window.confirm('Remove WBS number ' + wbsNumber + ' from the registry? This cannot be undone.')) {
      return;
    }
    $.ajax({
      url: '/api/wbs-notifications/' + encodeURIComponent(wbsNumber),
      method: 'DELETE',
      success: function () {
        showWbsMessage('success', 'WBS number ' + wbsNumber + ' removed from the registry.');
        loadWbsNotifications();
      },
      error: function (jqXHR) {
        var resp = jqXHR.responseJSON || {};
        showWbsMessage('error', resp.message || 'Failed to remove the WBS number.');
      },
    });
  });
});
