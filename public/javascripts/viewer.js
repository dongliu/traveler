$(function(){
  $('input, textarea').removeAttr('disabled');
  var $legend = $('legend');
  var $affix = $('<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="10"></ul>');
  var $toggle = $('<div class="sidenavtoggle"><a id="toggle" class="btn btn-primary" data-toggle="tooltip" title="show/hide side nav"><i class="fa fa-anchor fa-lg"></i></a></div>');
  var i;
  if ($legend.length > 1) {
    for (i = 0; i < $legend.length; i += 1) {
      $affix.append('<li><a href="#' + $legend[i].id + '">' + $legend[i].textContent + '</a></li>');
    }
    $('body').append($('<div id="affixlist" class="bs-docs-sidebar"></div>').append($affix));
    $('body').attr('data-spy', 'scroll');
    $('body').attr('data-target', '#affixlist');
    $('#affixlist').hide();
    $('body').append($toggle);
    $('#toggle').click(function (e) {
      e.preventDefault();
      $('#affixlist').toggle();
    });
  }
});
