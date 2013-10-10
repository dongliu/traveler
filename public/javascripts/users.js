$(function() {
  var users = [];
  var nameCache = {};

  $('#user-name').autocomplete(nameAuto('#user-name', nameCache));

  var userTable = $('#users').dataTable({
    'aaData': users,
    'bAutoWidth': false,
    'aoColumns': [{
      'sTitle': 'ID'
    }, {
      'sTitle': 'Full name'
    }, {
      'sTitle': 'Privileges'
    }, {
      'sTitle': 'Last visited on'
    }],
    'aaSorting': [
      [1, 'desc']
    ],
    "sDom": "<'row-fluid'<'span6'T><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>",
    "oTableTools": {
      "sSwfPath": "datatables/swf/copy_csv_xls_pdf.swf",
      "aButtons": [
        "copy",
        "print", {
          "sExtends": "collection",
          "sButtonText": 'Save <span class="caret" />',
          "aButtons": ["csv", "xls", "pdf"]
        }
      ]
    }
  });

  $.ajax({
    url: '/users/json',
    type: 'GET',
    dataType: 'json'
  }).done(function(json) {
    users = json.map(function(user) {
      return [].concat(user.id).concat(user.name).concat(user.roles.join()).concat(user.lastVisitedOn ? moment(user.lastVisitedOn).format('YYYY-MM-DD HH:mm:ss') : '');
    });
    userTable.fnClearTable();
    userTable.fnAddData(users);
    userTable.fnDraw();
    $('tbody tr', '#users').click(function(e) {
      var id = userTable.fnGetData(this, 0);
      window.open('/users/' + id);
      e.preventDefault();
    });
  }).fail(function(jqXHR, status, error) {
    $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Cannot reach the server for cable requests.</div>');
  }).always();

});

// function rolesForm(roles) {
//   var form = $('form[name = "roles"]').clone();
//   form.show();
//   for (var i = 0; i < roles.length; i += 1) {
//     $('input[value= "' + roles[i] + '"]', form).attr('checked', 'checked');
//   }
//   return form.html();
// }