/*global prefix, livespan, ajax401*/

$(function() {
  /**
   * send request with data, and exec cb on response
   *
   * @param   {Object}  data    request body data
   * @param   {function}  cb    callback
   *
   * @return  {void}
   */
  function sendRequest(data, cb) {
    var path = window.location.pathname;
    var url = path + 'status';
    var type = 'PUT';
    $.ajax({
      url: url,
      type: type,
      async: true,
      data: JSON.stringify(data),
      contentType: 'application/json',
      processData: false,
    }).done(function(data, textStatus, request) {
      var timestamp = request.getResponseHeader('Date');
      if (data.location) {
        document.location.href = data.location;
      } else {
        $('#message').append(
          '<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>The changes were saved ' +
            livespan(timestamp) +
            '.</div>'
        );
      }
      $.livestamp.resume();
      if (cb) {
        cb();
      }
    });
  }
  $('#obsolete').click(function() {
    sendRequest(
      {
        status: 2,
        version: $('#version').text(),
      },
      function() {
        window.location.reload(true);
      },
      'status'
    );
  });

  ajax401(prefix);
});
