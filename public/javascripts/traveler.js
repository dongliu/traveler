$(function() {
  $('#form input,textarea').removeAttr('disabled');
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

      // $cgw.children('button[value="save"]').click(function(e) {
      //   e.preventDefault();
      //   $('#form input,textarea').removeAttr('disabled');
      // });
      // $cgw.children('button[value="reset"]').click(function(e) {
      //   e.preventDefault();
      //   $('#form input,textarea').removeAttr('disabled');
      // });

  });
  $('#form').on('click', 'button[value="save"]', function(e) {
    e.preventDefault();
    $('#form input,textarea').removeAttr('disabled');
  });

});