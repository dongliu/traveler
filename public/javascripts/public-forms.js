/*
 global prefix, ajax401, updateAjaxURL, disableAjaxCache: false formLinkColumn,
 titleColumn, ownerColumn, createdOnColumn, sharedWithColumn, sharedGroupColumn,
 fnAddFilterFoot, createdByColumn, createdOnColumn, sDomNoTools, filterEvent,
 formCloneColumn, formStatusColumn, tagsColumn, keysColumn, Holder,
 releasedFormLinkColumn, releasedFormCloneColumn, releasedFormStatusColumn,
 formTypeColumn, releasedFormVersionColumn, releasedByColumn, releasedOnColumn,
 */

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  var publicFormsAoColumns = [
    formLinkColumn,
    formCloneColumn,
    titleColumn,
    formStatusColumn,
    tagsColumn,
    keysColumn,
    createdByColumn,
    createdOnColumn,
    ownerColumn,
    sharedWithColumn,
    sharedGroupColumn,
  ];
  fnAddFilterFoot('#public-forms-table', publicFormsAoColumns);
  $('#public-forms-table').dataTable({
    sAjaxSource: '/publicforms/json',
    sAjaxDataProp: '',
    fnDrawCallback: function() {
      Holder.run({
        images: 'img.user',
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: publicFormsAoColumns,
    aaSorting: [[3, 'desc']],
    sDom: sDomNoTools,
  });

  /*released form table starts*/
  var releasedFormAoColumns = [
    releasedFormLinkColumn,
    releasedFormCloneColumn,
    titleColumn,
    releasedFormStatusColumn,
    formTypeColumn,
    releasedFormVersionColumn,
    tagsColumn,
    releasedByColumn,
    releasedOnColumn,
  ];
  $('#released-forms-table').dataTable({
    sAjaxSource: '/released-forms/json',
    sAjaxDataProp: '',
    fnDrawCallback: function() {
      Holder.run({
        images: 'img.user',
      });
    },
    bAutoWidth: false,
    bProcessing: true,
    iDisplayLength: 10,
    aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: releasedFormAoColumns,
    aaSorting: [[8, 'desc']],
    sDom: sDomNoTools,
  });
  fnAddFilterFoot('#released-forms-table', releasedFormAoColumns);
  /*released form table ends*/

  // binding events
  filterEvent();
});
