/*global prefix:false*/

function createSideNav() {
  var $legend = $('legend');
  var $affix = $(
    '<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>'
  );
  var i;
  if ($legend.length > 1) {
    for (i = 0; i < $legend.length; i += 1) {
      $affix.append(
        '<li><a href="#' +
          $legend[i].id +
          '">' +
          $legend[i].textContent +
          '</a></li>'
      );
    }
    $('.sidebar').append($('<div id="affixlist"></div>').append($affix));
    $('body').attr('data-spy', 'scroll');
    $('body').attr('data-target', '.sidebar');
  }
}

$(function() {
  $('#output')
    .find('img')
    .each(function(index) {
      var $this = $(this);
      if ($this.attr('name')) {
        if ($this.attr('src') === undefined) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if ($this.attr('src').indexOf('http') === 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
        if (prefix && $this.attr('src').indexOf(prefix) !== 0) {
          $($this.attr('src', prefix + '/formfiles/' + $this.attr('name')));
          return;
        }
      }
    });

  $('input, textarea').removeAttr('disabled');
  createSideNav();
  $('#show-validation').click(function() {
    $('.validation').remove();
    $('#validation').html(
      '<h3>Summary</h3>' + validationMessage(document.getElementById('output'))
    );
    $('#validation').show();
  });

  $('#hide-validation').click(function() {
    $('#validation').hide();
    $('.validation').hide();
  });
});
