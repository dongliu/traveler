/*global prefix, livespan, ajax401*/

/**
 * send request with data, and exec cb on response
 *
 * @param   {Object}  data    request body data
 * @param   {function}  cb    callback
 * @param   {String}  option  request option
 *
 * @return  {void}
 */
function sendRequest(data, cb, option) {
  const path = window.location.pathname;
  let url;
  if (option === 'revision') {
    url = `${path}revision`;
  } else if (option === 'status') {
    url = `${path}status`;
  } else {
    url = path;
  }
  const type = 'PUT';
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

$(function() {
  ajax401(prefix);
  travelerGlobal.usernames.initialize();

  $('#username').typeahead(
    {
      minLength: 1,
      highlight: true,
      hint: true,
    },
    {
      name: 'usernames',
      display: 'displayName',
      limit: 20,
      source: travelerGlobal.usernames,
    }
  );

  $('#notify').on('click', function(e) {
    e.preventDefault();
    const name = $('#username').val();
    const user = travelerGlobal.usernames.get(name);
    if (user === null || user.length === 0) {
      $('#message').append(
        `<div class="alert alert-info"><button class="close" data-dismiss="alert">x</button>Unknown user ${name}.  Please select from the list.</div>`
      );
      return;
    }
    const mail = user[0].mail;
    $.ajax({
      url: './notify',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        mail: mail,
        name: name,
      }),
      success(data, status, jqXHR) {
        $('#message').append(
          `<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>${jqXHR.responseText}</div>`
        );
        userTable.fnReloadAjax();
      },
      error(jqXHR) {
        $('#message').append(
          `<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the share list : ${jqXHR.responseText}</div>`
        );
      },
    });
    document.forms[0].reset();
  });

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

  $('#revision').click(function() {
    sendRequest(
      {
        version: $('#version').text(),
      },
      function() {
        window.location.reload(true);
      },
      'revision'
    );
  });
});
