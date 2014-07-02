function validation_message(form) {
  var i = 0,
    output = $('<div>'),
    p, value, input, label;
  for (i = 0; i < form.elements.length; i += 1) {
    input = form.elements[i];
    p = $('<p>');
    if (input.checkValidity()) {
      p.css('color', '#468847');
    } else {
      p.css('color', '#b94a48');
    }
    if (input.type == 'checkbox') {
      value = input.checked ? 'checked' : 'not checked';
    } else {
      if (input.value == '') {
        value = 'no input from user'
      } else {
        value = input.value;
      }
    }
    label = $(input).closest('.control-group').children('.control-label').text()
    if (input.checkValidity()) {
      p.html(label + ': ' + value );
    } else {
      p.html(label + ': ' + value + ' | Message: ' + input.validationMessage);
    }
    output.append(p);
  }
  return output;
}

$(function () {
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

  $('#show-validation').click(function () {
    $('#validation').html(validation_message(document.getElementById('output')));
    $('#validation').show();
  });

  $('#hide-validation').click(function () {
    $('#validation').hide();
  });
});
