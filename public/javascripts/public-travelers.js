/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global prefix: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false*/
/*global travelerLinkColumn: false, titleColumn: false, ownerColumn: false, deviceColumn: false, createdOnColumn: false, sharedWithColumn: false, sharedGroupColumn: false, fnAddFilterFoot: false, createdByColumn: false, createdOnColumn: false, sDomNoTools: false, filterEvent: false, Holder: false*/

$(function () {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();
  var publicTravelersAoColumns = [travelerLinkColumn, titleColumn, createdByColumn, createdOnColumn, ownerColumn, deviceColumn, sharedWithColumn, sharedGroupColumn];
  fnAddFilterFoot('#public-travelers-table', publicTravelersAoColumns);
  $('#public-travelers-table').dataTable({
    sAjaxSource: '/publictravelers/json',
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
    aoColumns: publicTravelersAoColumns,
    aaSorting: [
      [3, 'desc']
    ],
    sDom: sDomNoTools
  });
  // binding events
  filterEvent();
});
