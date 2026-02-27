function addVisit(location, method = 'GET') {
  $.ajax({
    url: '/users/visits',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ location, method }),
  });
}

function back() {
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
    .always(function() {
      $('#back').prop('disabled', false);
    });
}

function showHash() {
  if (window.location.hash) {
    $('.nav-tabs a[href=' + window.location.hash + ']').tab('show');
  }
}

function activeMenu() {
  const currentPath = window.location.pathname;
  const navLinks = $('.navbar.navbar-fixed-top .menu a');

  navLinks.each(function setActive() {
    const link = $(this);
    if (link.attr('href') === currentPath) {
      link.parent('li').addClass('active');
    }
  });
}

$(function tracking() {
  activeMenu();
  showHash();
  // update hash on tab changes
  $('.nav-tabs a').on('click', function(e) {
    window.location.hash = e.target.hash;
  });

  $(window).on('hashchange', function() {
    showHash();
  });

  if ($('button#refresh').length === 0 || $('button#back').length === 0) {
    return;
  }
  addVisit(
    document.location.pathname +
      document.location.search +
      document.location.hash,
    'GET'
  );
  $('#back').click(function(e) {
    e.target.disabled = true;
    back();
  });

  $('#refresh').click(function() {
    document.location.reload();
  });

  // add visit when hash changes
  $(window).on('hashchange', function() {
    addVisit(
      document.location.pathname +
        document.location.search +
        document.location.hash,
      'GET'
    );
  });
});
