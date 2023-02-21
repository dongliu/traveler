/*global moment: false*/
function appendMessage(message) {
  $('#message').append(
    '<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>' +
      message +
      '</div>'
  );
}

function updateApiKey(method, success) {
  $.ajax({
    url: '/profile/apikey',
    type: method,
  })
    .done(function(json) {
      appendMessage('Success!');
      success();
    })
    .fail(function(jqXHR, status, error) {
      appendMessage(
        'Request failed. You might need to try again or contact the admin.'
      );
    });
}

$(function() {
  var sub = $('#sub').prop('checked');
  $('#modify').on('click', function(e) {
    if ($('#sub').prop('checked') === sub) {
      appendMessage('The subscription state was not changed.');
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
          appendMessage(
            'The modification was saved at ' + dateObj.format('HH:mm:ss') + '.'
          );
        })
        .fail(function(jqXHR, status, error) {
          appendMessage(
            'The modification request failed. You might need to try again or contact the admin.'
          );
        });
    }
    e.preventDefault();
  });

  $('#gen-key').on('click', function(e) {
    updateApiKey('PUT', function() {
      location.reload();
    });
  });

  $('#revoke-key').on('click', function(e) {
    updateApiKey('DELETE', function() {
      location.reload();
    });
  });

  $('#copy-key').on('click', function(e) {
    navigator.clipboard.writeText(user.apiKey);
    appendMessage('API Key was copied to clipboard.');
  });
});
