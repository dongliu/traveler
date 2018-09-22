/*eslint max-nested-callbacks: [2, 4]*/

/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global sColumn, pColumn, vColumn, cColumn, travelerLinkColumn, aliasColumn, workProgressColumn, ownerColumn, deviceColumn, tagsColumn, manPowerColumn, sDomNoTools*/
/*global ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix: false, Holder*/


$(function () {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();

  var workAoColumns = [travelerLinkColumn, sColumn, pColumn, vColumn, cColumn, aliasColumn, ownerColumn, deviceColumn, tagsColumn, manPowerColumn, workProgressColumn];

  var worksTable = $('#work-table').dataTable({
    bAutoWidth: false,
    bPaginate: false,
    iDisplayLength: 10,
    aLengthMenu: [
      [10, -1],
      [10, 'All']
    ],
    oLanguage: {
      sLoadingRecords: 'Please wait - loading data from the server ...'
    },
    bDeferRender: true,
    aoColumns: workAoColumns,
    fnDrawCallback: function () {
      Holder.run({
        images: 'img.user'
      });
    },
    aaSorting: [
      [1, 'asc'],
      [2, 'asc']
    ],
    sDom: sDomNoTools
  });

  $.ajax({
    url: './works/json',
    type: 'GET',
    dataType: 'json'
  }).done(function (data) {
    worksTable.fnAddData(data.works);
    worksTable.fnDraw();
    $('#value-progress').html(data.valueProgress);
    $('#input-progress').html(data.inputProgress);
  }).always();

  $('#sort').click(function () {
    worksTable.fnSort([
      [1, 'asc'],
      [2, 'asc']
    ]);
  });
});
