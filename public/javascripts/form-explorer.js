const FormExplorer = (function(parent, $) {
  let releasedFormTable = null;
  let myFormTable = null;
  let formDom = null;
  let html = null;

  function retrieveForm(resource, fid, cb) {
    $.ajax({
      url: `/${resource}/${fid}/json`,
      type: 'GET',
      dataType: 'json',
      success: function(json) {
        cb(json);
      },
    });
  }

  function selectEvent() {
    $('tbody').on('click', 'a.preview', function preview() {
      const row = $(this).closest('tr');
      if (row.hasClass('row-selected')) {
        return;
      }
      $('tr').removeClass('row-selected');
      row.addClass('row-selected');

      const fid = this.id;
      const table = $(this).closest('table');
      let resource = 'forms';
      if (table.hasClass('released-forms')) {
        resource = 'released-forms';
      }

      retrieveForm(resource, fid, function(json) {
        formDom.fadeTo('slow', 1);
        html = json.html || json.base.html;
        loadForm(html);
      });
    });
  }

  function init(released, my, form) {
    const releasedColumns = [
      formExploreColumn,
      titleColumn,
      formTypeColumn,
      releasedOnColumn,
      releasedFormColumn,
    ];
    fnAddFilterFoot(released, releasedColumns);
    releasedFormTable = $(released).dataTable({
      sAjaxSource: '/released-forms/json',
      sAjaxDataProp: '',
      bProcessing: true,
      oLanguage: {
        sLoadingRecords: 'Please wait - loading data from the server ...',
      },
      aoColumns: releasedColumns,
      aaSorting: [[2, 'desc']],
      sDom: sDomPage,
    });
    const columns = [
      formExploreColumn,
      titleColumn,
      formTypeColumn,
      updatedOnColumn,
      formColumn,
    ];
    fnAddFilterFoot(my, columns);
    myFormTable = $(my).dataTable({
      sAjaxSource: '/myforms/json',
      sAjaxDataProp: '',
      bProcessing: true,
      oLanguage: {
        sLoadingRecords: 'Please wait - loading data from the server ...',
      },
      aoColumns: columns,
      aaSorting: [[2, 'desc']],
      sDom: sDomPage,
    });
    formDom = $(form);
    filterEvent();
    selectEvent();
  }

  // temparary solution for the dirty forms
  function cleanForm() {
    $('.control-group-buttons', formDom).remove();
  }

  function renderImg() {
    formDom.find('img').each(function() {
      var $this = $(this);
      if ($this.attr('name')) {
        if ($this.attr('src') === undefined) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if ($this.attr('src').indexOf('http') === 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if (prefix && $this.attr('src').indexOf(prefix) !== 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
      }
    });
  }

  function renderForm() {
    cleanForm();
    renderImg();
  }

  function loadForm() {
    formDom.html(html);
    renderForm();
  }

  function getHtml() {
    return html;
  }

  parent.init = init;
  parent.getHtml = getHtml;
  return parent;
})({}, jQuery);
