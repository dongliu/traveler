/*
 global prefix, ajax401, updateAjaxURL, disableAjaxCache: false formLinkColumn,
 titleColumn, sDomNoTools, filterEvent, formStatusColumn, tagsColumn, Holder,
 versionColumn, reviewRequestedByColumn, reviewRequestedOnColumn
 */

import * as Table from './lib/table.js';

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
  ];
  const reviewTableConfig = {
    sAjaxSource: '/reviews/forms/active/json',
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
    sDom: sDomNoTools,
  };
  Table.sortByColumn(reviewTableConfig, reviewRequestedOnColumn, 'desc');
  const tables = [];
  Table.initTableIfExists($('#form-table'), reviewTableConfig, tables);

  // binding events
  filterEvent();
});
