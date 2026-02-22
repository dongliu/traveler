export function addVisit(location, method = 'GET') {
  $.ajax({
    url: '/users/visits',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ location, method }),
  });
}

export function back() {
  return $.ajax({
    url: '/users/visits/back',
    type: 'PUT',
    dataType: 'json',
  })
    .done(function(data) {
      if (data.location === null) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Already at the end of the navigation history</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
        return;
      }
      document.location.href = data.location;
    })
    .fail(function(jqXHR) {
      if (jqXHR.status !== 401) {
        $('#message').append(
          '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot go back: ' +
            jqXHR.responseText +
            '</div>'
        );
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    })
    .always();
}
