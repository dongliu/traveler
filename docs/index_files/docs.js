$(function() {
  $('body').attr('data-spy', 'scroll');
  $('body').attr('data-target', '.sidebar');
  setTimeout(function() {
    $('#affixlist').affix({
      offset: {
        top: 270,
        bottom: 270,
      },
    });
  }, 100);
});
