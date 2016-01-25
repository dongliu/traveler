/*global prefix:false*/

function createSideNav() {
  var $legend = $('legend');
  var $affix = $('<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>');
  var i;
  if ($legend.length > 1) {
    for (i = 0; i < $legend.length; i += 1) {
      $affix.append('<li><a href="#' + $legend[i].id + '">' + $legend[i].textContent + '</a></li>');
    }
    $('.sidebar').append($('<div id="affixlist"></div>').append($affix));
    $('body').attr('data-spy', 'scroll');
    $('body').attr('data-target', '#affixlist');
  }
}

function validation_message(form) {
  var i = 0;
  var output = $('<div>');
  var p, value, input, label, span;
  for (i = 0; i < form.elements.length; i += 1) {
    input = form.elements[i];
    p = $('<p>');
    span = $('<span class="validation">');
    if (input.checkValidity()) {
      p.css('color', '#468847');
      span.css('color', '#468847');
    } else {
      p.css('color', '#b94a48');
      span.css('color', '#b94a48');
    }
    if (input.type === 'checkbox') {
      value = input.checked ? 'checked' : 'not checked';
    } else {
      if (input.value === '') {
        value = 'no input from user';
      } else {
        value = input.value;
      }
    }
    label = $(input).closest('.control-group').children('.control-label').text();
    if (input.checkValidity()) {
      p.html('<b>' + label + '</b>: ' + value);
      span.text('validation passed');
    } else {
      p.html('<b>' + label + '</b>: ' + value + ' | Message: ' + input.validationMessage);
      span.text(input.validationMessage);
    }
    $(input).closest('.controls').append(span);
    output.append(p);
  }
  return output;
}

$(function () {
  $('#output').find('img').each(function (index) {
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
  $('#show-validation').click(function () {
    $('.validation').remove();
    $('#validation').html('<h3>Summary</h3>' + validation_message(document.getElementById('output')).html());
    $('#validation').show();
  });

  $('#hide-validation').click(function () {
    $('#validation').hide();
    $('.validation').hide();
  });

});
