$(function() {
  init();
  working();
});

function init () {
  $('#add-item-form').hide();
  $('#output').sortable({
    placeholder: "ui-state-highlight"
  });
  $('#output').disableSelection();
}

function working () {
  $('#add-checkbox').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Checkbox');
    $.data($('#done')[0], 'item', 'checkbox');
    // the working part
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#general').show();
      $('#button').show();
    });
    // the output part
    var element = $('#general-element .control-group').clone().show();
    $('#output').append(element);
    $('#label').attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('label span', element).attr("data-bind", "text: label");
    var formModel = function (init) {
      this.label = ko.observable(init);
    }
    ko.applyBindings(new formModel("update me"));
    e.preventDefault();
  });

  $('#add-text').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Text');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#general').show();
      $('#input').show();
      $('#button').show();
    });
    var element1 = $('#general-element .control-group').clone().show();
    $('#output').append(element);
    var element2 = $('#general-element .control-group').clone().show();
    $('#output').append(element);
    $('#label').attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('label span', element).attr("data-bind", "text: label");
    var formModel = function (init) {
      this.label = ko.observable(init);
    }
    ko.applyBindings(new formModel("update me"));
    e.preventDefault();
  });

  $('#add-par').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Paragraph');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#general').show();
      $('#input').show();
      $('#paragraph').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#add-int').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Integer');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#general').show();
      $('#input').show();
      $('#number').show();
    });
    e.preventDefault();
  });

  $('#add-float').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Float');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#general').show();
      $('#input').show();
      $('#number').show();
    });
    e.preventDefault();
  });

  $('#add-file').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('File');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#upload').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#add-link').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Link');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#link').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#add-rich').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Rich instruction');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#rich').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#add-hold').click(function(e){
    $('#add-item-form').show();
    $('#add-item-form legend').text('Hold point');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show()
      $('#hold').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#done').click(function(e){
    // clean the ko binding
    // ko.cleanNode($('#output')[0]);
    ko.cleanNode($('#label')[0]);
    $('#output [data-bind]').removeAttr('data-bind');
    $('#add-item-form [data-bind]').removeAttr('data-bind');
    // hide the add-item-form
    $('.add-item').hide();
    $('#add-item-form').hide();

    // console.log($.data($('#add')[0], 'item'));
    // var item = $.data($('#done')[0], 'item');
    // var element;
    // switch(item) {
    //   case 'checkbox':
        // console.log($.data($('#add')[0], 'item'));
        // element = $('#checkbox-element .control-group').clone().show();
        // $('.control-label', element).html($('#label').val());
        // $('#output').append(element);
        // $('.add-item').hide();
        // $('#add-item-form').hide();
        // // break;
    //   default:
    //     $('.add-item').hide();
    //     $('#add-item-form').hide();
    //     break;
    // }
    e.preventDefault();
    // return false;
  });

  $('#cancel').click(function(e){
    // clean the ko binding
    // ko.cleanNode($('#output')[0]);
    ko.cleanNode($('#label')[0]);
    $('#output [data-bind]').removeAttr('data-bind');
    $('#add-item-form [data-bind]').removeAttr('data-bind');

    // remove the last element just appended
    $('#output .control-group').last().remove();

    // hide the add-item-form
    $('.add-item').hide();
    $('#add-item-form').hide();

    // console.log($.data($('#add')[0], 'item'));
    // var item = $.data($('#done')[0], 'item');
    // var element;
    // switch(item) {
    //   case 'checkbox':
        // console.log($.data($('#add')[0], 'item'));
        // element = $('#checkbox-element .control-group').clone().show();
        // $('.control-label', element).html($('#label').val());
        // $('#output').append(element);
        // $('.add-item').hide();
        // $('#add-item-form').hide();
        // // break;
    //   default:
    //     $('.add-item').hide();
    //     $('#add-item-form').hide();
    //     break;
    // }
    e.preventDefault();
    // return false;
  });

}