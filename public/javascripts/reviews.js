/*
 global prefix, ajax401, updateAjaxURL, disableAjaxCache: false formLinkColumn,
 titleColumn, fnAddFilterFoot, sDomNoTools, filterEvent, formStatusColumn, tagsColumn, Holder,
 versionColumn, reviewRequestedByColumn, reviewRequestedOnColumn, reviewResultColumn
 */

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  const reviewFormsAoColumns = [
    formLinkColumn,
    titleColumn,
    versionColumn,
    formStatusColumn,
    tagsColumn,
    reviewRequestedByColumn,
    reviewRequestedOnColumn,
    reviewResultColumn,
  ];
  fnAddFilterFoot('#public-forms-table', reviewFormsAoColumns);
  $('#form-table').dataTable({
    sAjaxSource: '/reviews/forms/json',
    sAjaxDataProp: '',
    fnDrawCallback() {
      Holder.run({
        images: 'img.user',
      });
    },
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All'],
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...',
    },
    bDeferRender: true,
    aoColumns: reviewFormsAoColumns,
    aaSorting: [[5, 'desc']],
    sDom: sDomNoTools,
  });

  // binding events
  filterEvent();
});
