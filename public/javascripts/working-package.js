/*eslint max-nested-callbacks: [2, 4]*/

/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global removeColumn, sequenceColumn, colorColumn, priorityColumn, valueColumn, travelerLinkColumn, aliasColumn, addedByColumn, addedOnColumn, ownerColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, sDomNoTools*/
/*global moment: false, ajax401: false, updateAjaxURL: false, disableAjaxCache: false, prefix: false*/

$(function () {
  updateAjaxURL(prefix);
  ajax401(prefix);
  disableAjaxCache();
  $('span.time').each(function () {
    $(this).text(moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a'));
  });
  var initValue = {
    title: $('#title').text(),
    description: $('#description').text()
  };

  var workAoColumns = [sequenceColumn, priorityColumn, valueColumn, travelerLinkColumn, aliasColumn, ownerColumn, deviceColumn, sharedWithColumn, sharedGroupColumn, workProgressColumn];

  var worksTable = $('#work-table').dataTable({
    sAjaxSource: './works/json',
    sAjaxDataProp: '',
    bAutoWidth: false,
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
    // aaSorting: [
    //   [10, 'desc'],
    //   [8, 'desc']
    // ],
    sDom: sDomNoTools
  });
});
