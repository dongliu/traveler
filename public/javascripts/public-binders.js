/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false*/
/*global selectColumn: false, titleColumn: false, createdOnColumn: false, updatedOnColumn: false, updatedByColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, sDomNoTools: false, createdByColumn: false, createdOnColumn: false, fnGetSelected: false, selectEvent: false, filterEvent: false, clonedByColumn: false, archivedOnColumn: false, binderConfigLinkColumn: false, binderShareLinkColumn: false, binderLinkColumn: false, tagsColumn: false, binderProgressColumn: false, transferredOnColumn: false, ownerColumn: false*/
/*global archiveFromModal, transferFromModal, modalScroll*/

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  var publicBindersAoColumns = [binderLinkColumn, titleColumn, tagsColumn, ownerColumn, createdOnColumn, updatedByColumn, updatedOnColumn, binderProgressColumn];
  fnAddFilterFoot('#public-binders-table', publicBindersAoColumns);
  $('#public-binders-table').dataTable({
    sAjaxSource: '/publicbinders/json',
    sAjaxDataProp: '',
    fnInitComplete: function () {
      Holder.run({
        images: 'img.user'
      });
    },
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
    aoColumns: publicBindersAoColumns,
    aaSorting: [
      [5, 'desc']
    ],
    sDom: sDomNoTools
  });
  // binding events
  filterEvent();
});
