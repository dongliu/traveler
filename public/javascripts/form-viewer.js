/*global prefix, createSideNav, validationMessage*/

$(function() {
  $('#output')
    .find('img')
    .each(function() {
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
