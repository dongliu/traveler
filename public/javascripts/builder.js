$(function() {
  init();
  working();
});

function init () {
  $('#add-item-form').hide();
  $('#output').sortable({
    placeholder: "ui-state-highlight"
  });
  $('#output').on('mouseover', '.control-group', function(){
    $(this).addClass('control-group-highlight');
    $('.control-group-buttons', this).show();
  });
  $('#output').on('mouseout', '.control-group', function(){
    $(this).removeClass('control-group-highlight');
    $('.control-group-buttons', this).hide();
  });

  $('#output').disableSelection();
}

function working () {
  $('#add-checkbox').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Checkbox');
    $.data($('#done')[0], 'item', 'checkbox');
    // the working part
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#general').show();
      $('#button').show();
    });
    // the output part
    var element = $('#checkbox-element .control-group').clone().show();
    $('#output').append(element);
    $('#label').attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('label span', element).attr("data-bind", "text: label");
    var formModel = function (init) {
      this.label = ko.observable(init);
    };
    ko.applyBindings(new formModel("update me"));
    e.preventDefault();
  });

  $('#add-text').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Text');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#general').show();
      $('#input').show();
      $('#button').show();
    });
    var element = $('#text-element .control-group').clone().show();
    $('#output').append(element);

    $('#label').attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('.control-label span', element).attr("data-bind", "text: label");

    $('#placeholder').attr("data-bind", "value: placeholder, valueUpdate: 'afterkeydown'");
    $('input', element).attr("data-bind", "attr: {placeholder: placeholder}");

    $('#inline').attr("data-bind", "value: inline, valueUpdate: 'afterkeydown'");
    $('span.help-inline', element).attr("data-bind", "text: inline");

    var formModel = function (init) {
      this.label = ko.observable(init);
      this.placeholder = ko.observable("");
      this.inline = ko.observable("");
    };
    ko.applyBindings(new formModel("Update me"));

    e.preventDefault();
  });

  $('#add-par').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Paragraph');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#general').show();
      $('#input').show();
      $('#paragraph').show();
      $('#button').show();
    });

    var element = $('#textarea-element .control-group').clone().show();
    $('#output').append(element);
    $('#label').attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('#placeholder').attr("data-bind", "value: placeholder, valueUpdate: 'afterkeydown'");
    $('#rows').attr("data-bind", "value: rows, valueUpdate: 'afterkeydown'");
    $('#inline').attr("data-bind", "value: inline, valueUpdate: 'afterkeydown'");

    $('span.help-inline', element).attr("data-bind", "text: inline");
    $('.control-label span', element).attr("data-bind", "text: label");
    $('textarea', element).attr("data-bind", "attr: {placeholder: placeholder, rows: rows}");

    var formModel = function (init) {
      this.label = ko.observable(init);
      this.placeholder = ko.observable("");
      this.inline = ko.observable("");
      this.rows = ko.observable(3);
    };
    ko.applyBindings(new formModel("Update me"));

    e.preventDefault();
  });

  $('#add-int').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Integer');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#general').show();
      $('#input').show();
      $('#number').show();
    });
    e.preventDefault();
  });

  $('#add-float').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Float');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#general').show();
      $('#input').show();
      $('#number').show();
    });
    e.preventDefault();
  });

  $('#add-file').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('File');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#upload').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#add-link').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Link');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#link').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#add-rich').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Rich instruction');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#rich').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#add-hold').click(function(e){
    $('#add-item-form').show();
    cleanko();
    $('#add-item-form legend').text('Hold point');
    $('.add-item').hide(100, function(){
      $('#add-item-form legend').show();
      $('#hold').show();
      $('#button').show();
    });
    e.preventDefault();
  });

  $('#done').click(function(e){
    // clean the ko binding
    cleanko();
    // hide the add-item-form
    $('.add-item').hide();
    $('#add-item-form').hide();

    // $('#output .control-group').hover(
    // function(){
    //   $(this).addClass('control-group-highlight');
    // },
    // function(){
    //   $(this).removeClass('control-group-highlight');
    // }
    // );

    e.preventDefault();
  });

  $('#cancel').click(function(e){
    // clean the ko binding
    cleanko();

    // remove the last element just appended
    $('#output .control-group').last().remove();

    // hide the add-item-form
    $('.add-item').hide();
    $('#add-item-form').hide();

    e.preventDefault();
  });

}

function cleanko() {
  $('#add-item-form input').each(function(index) {
    ko.cleanNode(this);
  });

  $('#output [data-bind]').removeAttr('data-bind');
  $('#add-item-form [data-bind]').removeAttr('data-bind');
}