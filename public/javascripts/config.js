$(function(){
  var initValue = {
    title : $('#title').text(),
    description: $('#description').text()
  };
  // var title = $('#title').text();
  // var description = $('#description').text();

  var path = window.location.pathname;

  $('.editable').editable(function(value, settings){
    var that = this;
    if (value == initValue[that.id]) {
      // console.log('not changed');
      return value;
    }
    var data = {};
    data[that.id] = value;
    $.ajax({
      url: path,
      type: 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: function(data) {
        initValue[that.id] = value;
      },
      error: function(jqXHR, status, error) {
        $(that).text(initValue[that.id]);
        $('#message').append('<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the traveler config : ' + jqXHR.responseText + '</div>');
        $(window).scrollTop($('#message div:last-child').offset().top - 40);
      }
    });
    return value;
  }, {
    type: 'textarea',
    rows: 1,
    cols: 120,
    style: 'display: inline',
    cancel: 'Cancel',
    submit: 'Update',
    indicator: 'Updating...',
    tooltip: 'Click to edit...'
  });
});