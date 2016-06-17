/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false*/
/*global formLinkColumn: false, titleColumn: false, ownerColumn: false, createdOnColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, createdByColumn: false, createdOnColumn: false, sDomNoTools: false, filterEvent: false*/

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  var publicFormsAoColumns = [formLinkColumn, titleColumn, createdByColumn, createdOnColumn, ownerColumn, sharedWithColumn, sharedGroupColumn];
  fnAddFilterFoot('#public-forms-table', publicFormsAoColumns);
  $('#public-forms-table').dataTable({
    sAjaxSource: '/publicforms/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, 50, 100, -1],
      [10, 50, 100, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: publicFormsAoColumns,
    aaSorting: [
      [3, 'desc']
    ],
    sDom: sDomNoTools
  });
  // binding events
  filterEvent();
});
