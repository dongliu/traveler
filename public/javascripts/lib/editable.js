export const editableSpan = 'span.editable';
export const editableButton = 'button.editable';
export function binding($, initValue, path) {
  $(editableSpan).editable(
    function(value) {
      var that = this;
      if (value === initValue[that.id]) {
        return value;
      }
      var data = {};
      data[that.id] = value;
      $.ajax({
        url: path || window.location.pathname,
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(json) {
          initValue[that.id] = json[that.id];
          $(that).html(json[that.id]);
        },
        error: function(jqXHR) {
          $(that).text(initValue[that.id]);
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot update the traveler config : ' +
              jqXHR.responseText +
              '</div>'
          );
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        },
      });
      return '';
    },
    {
      type: 'textarea',
      rows: 1,
      cols: 120,
      style: 'display: inline',
      cancel: 'Cancel',
      submit: 'Update',
      indicator: 'Updating...',
      tooltip: 'Click to edit...',
    }
  );

  $(editableButton).click(function() {
    $(this)
      .siblings('span.editable')
      .first()
      .click();
  });
}
