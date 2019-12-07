$(function() {
    updateAjaxURL(prefix);

    var memberColumns = [
        selectColumn,
        userIdColumn,
        fullNameNoLinkColumn,
    ];

    var memberTable = $('#members-table').dataTable({
        sAjaxSource: '/groups/' + group._id + '/members/json',
        sAjaxDataProp: '',
        /*fnInitComplete: function () {
            Holder.run({
                images: 'img.group',
            });
        },*/
        bAutoWidth: false,
        iDisplayLength: 10,
        aLengthMenu: [[10, 50, 100, -1], [10, 50, 100, 'All']],
        oLanguage: {
            sLoadingRecords: 'Please wait - loading data from the server ...',
        },
        bDeferRender: true,
        aoColumns: memberColumns,
        aaSorting: [[2, 'asc']],
        sDom: sDomNoTools,
    });
    fnAddFilterFoot('#members-table', memberColumns);

    selectEvent();
    filterEvent();

});
