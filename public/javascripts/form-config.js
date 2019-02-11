/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false */
/*global moment: false, ajax401: false, prefix: false, updateAjaxURL: false, disableAjaxCache: false*/

$(function() {
  ajax401(prefix);
  updateAjaxURL(prefix);
  disableAjaxCache();

  function cleanTagForm() {
    $('#new-tag')
      .closest('li')
      .remove();
    $('#add-tag').removeAttr('disabled');
  }

  $('span.time').each(function() {
    $(this).text(
      moment($(this).text()).format('dddd, MMMM Do YYYY, h:mm:ss a')
    );
  });
  var initValue = {
    title: $('#title').text(),
    description: $('#description').text(),
  };

  $('span.editable').editable(
    function(value) {
      var that = this;
      if (value === initValue[that.id]) {
        return value;
      }
      var data = {};
      data[that.id] = value;
      $.ajax({
        url: '.',
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(json) {
          initValue[that.id] = json[that.id];
          $(that).text(json[that.id]);
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

  $('button.editable').click(function() {
    $(this)
      .siblings('span.editable')
      .first()
      .click();
  });

  var tags;

  $('#add-tag').click(function(e) {
    e.preventDefault();
    // add an input and a button add
    $('#add-tag').attr('disabled', true);
    $('#tags').append(
      '<li><form class="form-inline"><input id="new-tag" type="text"> <button id="confirm" class="btn btn-primary">Confirm</button> <button id="cancel" class="btn">Cancel</button></form></li>'
    );
    $('#cancel').click(function(cancelE) {
      cancelE.preventDefault();
      cleanTagForm();
    });

    if (!tags) {
      tags = [];
    }

    $('#confirm').click(function(confirmE) {
      confirmE.preventDefault();
      if (
        $('#new-tag')
          .val()
          .trim()
      ) {
        $.ajax({
          url: './tags/',
          type: 'POST',
          contentType: 'application/json',
          data: JSON.stringify({
            newtag: $('#new-tag')
              .val()
              .trim(),
          }),
        })
          .done(function(data, textStatus, jqXHR) {
            if (jqXHR.status === 204) {
              return;
            }
            if (jqXHR.status === 200) {
              $('#tags').append(
                '<li><span class="tag">' +
                  data.tag +
                  '</span> <button class="btn btn-small btn-warning remove-tag"><i class="fa fa-trash-o fa-lg"></i></button></li>'
              );
            }
          })
          .fail(function(jqXHR) {
            if (jqXHR.status !== 401) {
              $('#message').append(
                '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot add the tag</div>'
              );
              $(window).scrollTop(
                $('#message div:last-child').offset().top - 40
              );
            }
          })
          .always(function() {
            cleanTagForm();
            $('#add-tag').removeAttr('disabled');
          });
      }
    });
  });

  $('#tags').on('click', '.remove-tag', function(e) {
    e.preventDefault();
    var $that = $(this);
    $.ajax({
      url: './tags/' + encodeURIComponent($that.siblings('span.tag').text()),
      type: 'DELETE',
    })
      .done(function() {
        $that.closest('li').remove();
      })
      .fail(function(jqXHR) {
        if (jqXHR.status !== 401) {
          $('#message').append(
            '<div class="alert alert-error"><button class="close" data-dismiss="alert">x</button>Cannot remove the tag</div>'
          );
          $(window).scrollTop($('#message div:last-child').offset().top - 40);
        }
      })
      .always();
  });
});
