$(function() {
  var binder = new Binder.FormBinder(document.forms[0]);
  $.ajax({
    url: './data/',
    type: 'GET',
    dataType: 'json'
  }).done(function(data, status, jqXHR) {
    $('#form input,textarea').each(function(index, element) {
      var found = data.filter(function(e) {
        return e.name == element.name;
      });
      if (found.length) {
        found.sort(function(a, b) {
          if (a.inputOn > b.inputOn) {
            return -1;
          } else {
            return 1;
          }
        });
        binder.deserializeFieldFromValue(element, found[0].value);
        binder.accessor.set(element.name, found[0].value);
        $(element).closest('.controls').append('<div class="history">' + history(found) + '</div>');
      }
    });
  }).fail(function(jqXHR, status, error) {
    $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot get saved traveler data</div>');
    $(window).scrollTop($('#message div:last-child').offset().top - 40);
  }).always();

});

function history(found) {
  var output = 'changed by ' + found[0].inputBy + ' ' + moment(found[0].inputOn).fromNow();
  if (found.length > 1) {
    for (var i = 1; i < found.length; i += 1) {
      output = output + '; changed to <strong>' + found[i].value + '</strong> by ' + found[i].inputBy + ' ' + moment(found[i].inputOn).fromNow();
    }
  }
  return output;
}
