$(function() {
  update(roles);
  $('#modify').click(function(e) {
    var currentRoles = [];
    $('#roles input:checked').each(function() {
      currentRoles.push($(this).val());
    });
    if (roles.sort().join() == currentRoles.sort().join()) {
      $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Nothing was changed.</div>');
    } else {
      roles = currentRoles;
      var request = $.ajax({
        // url: '/users/'+id,
        type: 'PUT',
        async: true,
        data: JSON.stringify({
          roles: roles
        }),
        contentType: 'application/json',
        processData: false,
        dataType: 'json'
      }).done(function(json) {
        var timestamp = request.getResponseHeader('Date');
        var dateObj = moment(timestamp);
        $('#message').append('<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The modification was saved at ' + dateObj.format('HH:mm:ss') + '.</div>');
      }).fail(function(jqXHR, status, error) {
        // TODO change to modal
        alert('The save request failed. You might need to try again or contact the admin.');
      }).always(function() {});
    }
    e.preventDefault();
  });
});

function update(roles) {
  for (var i = 0; i < roles.length; i += 1) {
    $('input[value= "' + roles[i] + '"]').prop('checked', true);
  }
}