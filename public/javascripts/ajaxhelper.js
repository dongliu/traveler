/*global window: false*/

function updateAjaxURL(prefix) {
  if (prefix) {
    $.ajaxPrefilter(function (options) {
      // when the prefix is /traveler, it conflicts with resources like /travelers/...
      if (options.url.indexOf(prefix + '/') !== 0) {
        options.url = prefix + options.url;
      }
    });
  }
}

function ajax401(prefix) {
  $(document).ajaxError(function (event, jqXHR, settings, exception) {
    if (jqXHR.status === 401) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Please click <a href="' + prefix + '/login" target="_blank">login</a>, log in, and then save the changes on this page.</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }
  });
}

function disableAjaxCache() {
  var ua = window.navigator.userAgent;
  var msie = ua.indexOf("MSIE ");
  if (msie > 0) {
    $.ajaxSetup({
      cache: false
    });
  }
}
