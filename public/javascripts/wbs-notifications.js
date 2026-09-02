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
    '<tr>' +
    '<td>' + escapeHtml(entry.wbs_number) + '</td>' +
    '<td>' + escapeHtml(entry.notification_email) + '</td>' +
    '</tr>'
  );
}

function renderWbsTable(entries) {
  var $tbody = $('#wbs-notifications-tbody');
  $tbody.empty();
  if (!entries.length) {
    $tbody.append('<tr class="wbs-notifications-empty"><td colspan="2">No WBS notification mappings loaded (wbs.yaml not found or empty).</td></tr>');
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
      showWbsMessage('error', resp.message || 'Failed to load the WBS notification mappings.');
    },
  });
}

$(function () {
  updateAjaxURL(prefix);
  loadWbsNotifications();
});
