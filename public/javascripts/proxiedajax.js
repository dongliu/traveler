/*global window: false*/

function updateAjaxURL(prefix) {
  if (prefix) {
    $.ajaxPrefilter(function (options) {
      // when the prefix is /traveler, it confilict with resources like /travelers/...
      if (options.url.indexOf(prefix + '/') !== 0) {
        options.url = prefix + options.url;
      }
    });
  }
}

function ajax401(prefix) {
  $(document).ajaxError(function (event, jqXHR) {
    if (jqXHR.status >= 400) {
      if (jqXHR.status === 401) {
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="' + prefix + '/login" target="_blank">traveler log in</a>, and then save the changes on this page.</div>');
      } else {
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>HTTP request failed.</div>');
      }
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });
}
