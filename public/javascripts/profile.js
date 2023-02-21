/*global moment: false*/

$(function() {
  var sub = $('#sub').prop('checked');
  $('#modify').click(function(e) {
    if ($('#sub').prop('checked') === sub) {
      $('#message').append(
        '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The subscription state was not changed.</div>'
      );
    } else {
      sub = $('#sub').prop('checked');
      var request = $.ajax({
        type: 'PUT',
        async: true,
        data: JSON.stringify({
          subscribe: sub,
        }),
        contentType: 'application/json',
        processData: false,
        dataType: 'json',
      })
        .done(function(json) {
          var timestamp = request.getResponseHeader('Date');
          var dateObj = moment(timestamp);
          $('#message').append(
            '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The modification was saved at ' +
              dateObj.format('HH:mm:ss') +
              '.</div>'
          );
        })
        .fail(function(jqXHR, status, error) {
          $('#message').append(
            '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>The modification request failed. You might need to try again or contact the admin.</div>'
          );
        });
    }
    e.preventDefault();
  });
});
