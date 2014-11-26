function updateAjaxURL(prefix) {
  if (prefix) {
    $.ajaxPrefilter(function (options) {
      options.url = prefix + options.url;
    });
  }
}
