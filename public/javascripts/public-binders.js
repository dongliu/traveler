/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false*/
/*global titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, fnAddFilterFoot: false, sDomNoTools: false, createdOnColumn: false, filterEvent: false, binderLinkColumn: false, tagsColumn: false, binderWorkProgressColumn: false, ownerColumn: false*/

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  var publicBindersAoColumns = [
    binderLinkColumn,
    titleColumn,
    tagsColumn,
    ownerColumn,
    createdOnColumn,
    updatedByColumn,
    updatedOnColumn,
    binderWorkProgressColumn,
  ];
  fnAddFilterFoot('#public-binders-table', publicBindersAoColumns);
  $('#public-binders-table').dataTable({
    sAjaxSource: '/publicbinders/json',
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
    aoColumns: publicBindersAoColumns,
    aaSorting: [[5, 'desc']],
    sDom: sDomNoTools,
  });
  // binding events
  filterEvent();
});
