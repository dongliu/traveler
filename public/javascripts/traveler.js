$(function() {
  $('#form input,textarea').removeAttr('disabled');

  var binder = new Binder.FormBinder(document.forms[0]);

  // deserialize the values here

  $('#form .control-group-wrap').mouseenter(function(e) {
    e.preventDefault();
    if (!$(this).hasClass('control-focus')) {
      $(this).addClass('control-focus');
      // $(this).prepend(input.button());
    }
  });
  $('#form .control-group-wrap').mouseleave(function(e) {
    e.preventDefault();
    if ($(this).hasClass('control-focus')) {
      $(this).removeClass('control-focus');
      // $('.control-group-buttons', $(this)).remove();
    }
  });

  $('#form input,textarea').change(function(e) {
    var $that = $(this);
    var $cgw = $that.closest('.control-group-wrap');
    $('#form input,textarea').not($that).attr('disabled', true);
    if ($cgw.children('.control-group-buttons').length == 0) {
      $cgw.prepend('<div class="pull-right control-group-buttons"><button value="save" class="btn btn-primary">Save</button> <button value="reset" class="btn">Reset</button></div>');
    }
  });


  $('#form').on('click', 'button[value="save"]', function(e) {
    e.preventDefault();
    // ajax to save the current value
    var $this = $(this);
    var input = $this.closest('.control-group-wrap').find('input,textarea')[0];
    binder.serializeField(input);
    console.log(getUpdate(binder, input));
    $.ajax({
      url: './data/',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        name: input.name,
        value: binder.accessor.target[input.name]
      })
    }).done(function(data, status, jqXHR) {
      // document.location.href = window.location.pathname;
      $('#message').append('<div class="alert alert-success"><button class="close" data-dismiss="alert">x</button>Change saved</div>');
    }).fail(function(jqXHR, status, error) {
      $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot change the status: ' + jqXHR.responseText + '</div>');
      $(window).scrollTop($('#message div:last-child').offset().top - 40);
    }).always();

    $('#form input,textarea').removeAttr('disabled');
    $this.closest('.control-group-buttons').remove();
  });


  $('#form').on('click', 'button[value="reset"]', function(e) {
    e.preventDefault();
    $('#form input,textarea').removeAttr('disabled');
    $(this).closest('.control-group-buttons').remove();
  });

});

function getUpdate(binder, element) {
  var update = {};
  update[element.name] = binder.accessor.target[element.name];
  return update;
}