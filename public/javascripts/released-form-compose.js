/* global ajax401: false, prefix: false, updateAjaxURL: false, baseHtml: false,
selectColumn: false, titleColumn: false, versionColumn: false */

$(function() {
  updateAjaxURL(prefix);

  // ordered list of chosen ACL forms: {_id, title, _v, html}
  const selected = [];

  $('#base-preview').html(baseHtml);

  const aclTable = $('#acl-table').dataTable({
    sAjaxSource: '/released-forms/acl/json',
    sAjaxDataProp: '',
    bProcessing: true,
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    aoColumns: [selectColumn, titleColumn, versionColumn],
    bPaginate: false,
  });

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findSelectedIndex(id) {
    return selected.findIndex(function matchId(acl) {
      return `${acl._id}` === `${id}`;
    });
  }

  function syncOrderFromDom() {
    const order = $('#acl-preview-list .acl-preview-item')
      .map(function getId() {
        return $(this).data('id');
      })
      .get();
    selected.sort(function byDomOrder(a, b) {
      return order.indexOf(`${a._id}`) - order.indexOf(`${b._id}`);
    });
  }

  function renderPreview() {
    const $list = $('#acl-preview-list');
    if ($list.hasClass('ui-sortable')) {
      $list.sortable('destroy');
    }
    $list.empty();
    selected.forEach(function appendSection(acl) {
      const $section = $(
        `<div class="acl-preview-item" data-id="${acl._id}" style="cursor: move;"></div>`
      );
      $section.append(
        `<div class="control-group acl-legend"><legend>${escapeHtml(
          acl.title
        )} (v${acl._v})</legend></div>`
      );
      $section.append(acl.html);
      $list.append($section);
    });
    $list.sortable({
      placeholder: 'ui-state-highlight',
      update() {
        syncOrderFromDom();
      },
    });
  }

  renderPreview();

  $('#acl-table tbody').on('change', 'input.select-row', function onToggle() {
    const $checkbox = $(this);
    const data = aclTable.fnGetData($checkbox.closest('tr')[0]);

    if ($checkbox.prop('checked')) {
      if (findSelectedIndex(data._id) === -1) {
        selected.push({
          _id: data._id,
          title: data.title,
          _v: data._v,
          html: data.base.html,
        });
      }
    } else {
      const index = findSelectedIndex(data._id);
      if (index !== -1) {
        selected.splice(index, 1);
      }
    }
    renderPreview();
  });

  $('#compose-confirm').click(function onConfirm() {
    const json = {
      title: $('#release-title').val(),
      aclFormIds: selected.map(function toId(acl) {
        return acl._id;
      }),
    };

    $.ajax({
      url: window.location.pathname,
      type: 'POST',
      data: JSON.stringify(json),
      contentType: 'application/json',
      processData: false,
    }).done(function onSuccess(data) {
      if (data.location) {
        document.location.href = data.location;
      }
    });
  });

  ajax401(prefix);
});
