$(function() {
  init();
  working();
});

function init () {
  $('#add-item-form').hide();
  $('#form-title h3.tinymce').tinymce({
    inline: true,
    toolbar: "undo redo",
    menubar: false,
    statusbar: false
  });
  $('#form-title div.tinymce').tinymce({
    inline: true,
    plugins: [["advlist autolink link image lists charmap print preview hr anchor pagebreak spellchecker"],
        ["searchreplace wordcount visualblocks visualchars code fullscreen insertdatetime media nonbreaking"],
        ["save table contextmenu directionality emoticons template paste"]],
    toolbar: "undo redo | styleselect | bold italic | subscript superscript | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image",
    statusbar: false
  });
  $('#adjust').click(function(e){
    if ($(this).text() == 'Adjust') {
      $(this).text('Done');
      $('#input-items').attr('disabled', true);
      $('#struct-items').attr('disabled', true);
      $('#save').attr('disabled', true);
      $('#output').sortable({
        placeholder: "ui-state-highlight"
      });
    } else {
      $(this).text('Adjust');
      $('#input-items').removeAttr('disabled');
      $('#struct-items').removeAttr('disabled');
      $('#save').removeAttr('disabled');
      $('#output').sortable('destroy');
    }
    e.preventDefault();
  });
  $('#output').on('mouseover', '.control-group', function(){
    $(this).addClass('control-group-highlight');
    $('.control-group-buttons', this).show();
  });
  $('#output').on('mouseout', '.control-group', function(){
    $(this).removeClass('control-group-highlight');
    $('.control-group-buttons', this).hide();
  });

}

function working () {
  $('#add-checkbox').click(function(e){
    cleanko();
    $('#add-item-form').empty();
    $('#add-item-form').show();
    var legend = $('#legend legend').clone().text('Add checkbox').show();
    var label = $('#label .control-group').clone().show();
    var button = $('#button .form-actions').clone().show();
    $('#add-item-form').append(legend);
    $('#add-item-form').append(label);
    $('#add-item-form').append(button);

    // the output part
    var element = $('#checkbox-element .control-group').clone().show();
    element.prepend($('#control-group-buttons .btn-group').clone());
    $('#output').append(element);
    $('input', label).attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('label span', element).attr("data-bind", "text: label");
    var formModel = function (init) {
      this.label = ko.observable(init);
    };
    ko.applyBindings(new formModel("update me"));
    bindingButton();
    e.preventDefault();
  });

  $('#add-text').click(function(e){
    cleanko();
    $('#add-item-form').empty();
    $('#add-item-form').show();
    var legend = $('#legend legend').clone().text('Add text input').show();
    var label = $('#label .control-group').clone().show();
    var placeholder = $('#placeholder .control-group').clone().show();
    var inline = $('#inline .control-group').clone().show();
    var button = $('#button .form-actions').clone().show();
    $('#add-item-form').append(legend);
    $('#add-item-form').append(label);
    $('#add-item-form').append(placeholder);
    $('#add-item-form').append(inline);
    $('#add-item-form').append(button);

    var element = $('#text-element .control-group').clone().show();
    element.prepend($('#control-group-buttons .btn-group').clone());
    $('#output').append(element);

    $('input', label).attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('.control-label span', element).attr("data-bind", "text: label");

    $('input', placeholder).attr("data-bind", "value: placeholder, valueUpdate: 'afterkeydown'");
    $('input', element).attr("data-bind", "attr: {placeholder: placeholder}");

    $('input', inline).attr("data-bind", "value: inline, valueUpdate: 'afterkeydown'");
    $('span.help-inline', element).attr("data-bind", "text: inline");

    var formModel = function (init) {
      this.label = ko.observable(init);
      this.placeholder = ko.observable("");
      this.inline = ko.observable("");
    };
    ko.applyBindings(new formModel("Update me"));
    bindingButton();
    e.preventDefault();
  });

  $('#add-par').click(function(e){
    cleanko();
    $('#add-item-form').empty();
    $('#add-item-form').show();
    var legend = $('#legend legend').clone().text('Add paragraph input').show();
    var label = $('#label .control-group').clone().show();
    var placeholder = $('#placeholder .control-group').clone().show();
    var inline = $('#inline .control-group').clone().show();
    var rows = $('#rows .control-group').clone().show();
    var button = $('#button .form-actions').clone().show();
    $('#add-item-form').append(legend);
    $('#add-item-form').append(label);
    $('#add-item-form').append(placeholder);
    $('#add-item-form').append(inline);
    $('#add-item-form').append(rows);
    $('#add-item-form').append(button);

    var element = $('#textarea-element .control-group').clone().show();
    element.prepend($('#control-group-buttons .btn-group').clone());
    $('#output').append(element);
    $('input', label).attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('input', placeholder).attr("data-bind", "value: placeholder, valueUpdate: 'afterkeydown'");
    $('input', rows).attr("data-bind", "value: rows, valueUpdate: 'afterkeydown'");
    $('input', inline).attr("data-bind", "value: inline, valueUpdate: 'afterkeydown'");

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
    bindingButton();
    e.preventDefault();
  });

  $('#add-int').click(function(e){
    cleanko();
    $('#add-item-form').empty();
    $('#add-item-form').show();
    var legend = $('#legend legend').clone().text('Add integer input').show();
    var label = $('#label .control-group').clone().show();
    var placeholder = $('#placeholder .control-group').clone().show();
    var inline = $('#inline .control-group').clone().show();
    var unit = $('#unit .control-group').clone().show();
    var button = $('#button .form-actions').clone().show();
    $('#add-item-form').append(legend);
    $('#add-item-form').append(label);
    $('#add-item-form').append(placeholder);
    $('#add-item-form').append(unit);
    $('#add-item-form').append(inline);
    $('#add-item-form').append(button);

    var element = $('#number-element .control-group').clone().show();
    element.prepend($('#control-group-buttons .btn-group').clone());
    $('#output').append(element);

    $('input', label).attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('.control-label span', element).attr("data-bind", "text: label");

    $('input', placeholder).attr("data-bind", "value: placeholder, valueUpdate: 'afterkeydown'");
    $('input', element).attr("data-bind", "attr: {placeholder: placeholder}");

    $('input', unit).attr("data-bind", "value: unit, valueUpdate: 'afterkeydown'");
    $('span.add-on', element).attr("data-bind", "text: unit");

    $('input', inline).attr("data-bind", "value: inline, valueUpdate: 'afterkeydown'");
    $('span.help-inline', element).attr("data-bind", "text: inline");

    var formModel = function (init) {
      this.label = ko.observable(init);
      this.placeholder = ko.observable("");
      this.unit = ko.observable("U");
      this.inline = ko.observable("");
    };
    ko.applyBindings(new formModel("Update me"));
    // TODO: add integer validation rule
    bindingButton();
    e.preventDefault();
  });

  $('#add-float').click(function(e){
    cleanko();
    $('#add-item-form').empty();
    $('#add-item-form').show();
    var legend = $('#legend legend').clone().text('Add float input').show();
    var label = $('#label .control-group').clone().show();
    var placeholder = $('#placeholder .control-group').clone().show();
    var inline = $('#inline .control-group').clone().show();
    var unit = $('#unit .control-group').clone().show();
    var button = $('#button .form-actions').clone().show();
    $('#add-item-form').append(legend);
    $('#add-item-form').append(label);
    $('#add-item-form').append(placeholder);
    $('#add-item-form').append(unit);
    $('#add-item-form').append(inline);
    $('#add-item-form').append(button);

    var element = $('#number-element .control-group').clone().show();
    element.prepend($('#control-group-buttons .btn-group').clone());
    $('#output').append(element);

    $('input', label).attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('.control-label span', element).attr("data-bind", "text: label");

    $('input', placeholder).attr("data-bind", "value: placeholder, valueUpdate: 'afterkeydown'");
    $('input', element).attr("data-bind", "attr: {placeholder: placeholder}");

    $('input', unit).attr("data-bind", "value: unit, valueUpdate: 'afterkeydown'");
    $('span.add-on', element).attr("data-bind", "text: unit");

    $('input', inline).attr("data-bind", "value: inline, valueUpdate: 'afterkeydown'");
    $('span.help-inline', element).attr("data-bind", "text: inline");

    var formModel = function (init) {
      this.label = ko.observable(init);
      this.placeholder = ko.observable("");
      this.unit = ko.observable("U");
      this.inline = ko.observable("");
    };
    ko.applyBindings(new formModel("Update me"));
    // TODO: add float validation rule
    bindingButton();
    e.preventDefault();
  });

  // $('#add-file').click(function(e){
  //   $('#add-item-form').show();
  //   cleanko();
  //   $('#add-item-form legend').text('File');
  //   $('.add-item').hide(100, function(){
  //     $('#add-item-form legend').show();
  //     $('#upload').show();
  //     $('#button').show();
  //   });
  //   e.preventDefault();
  // });

  $('#add-rich').click(function(e){
    // the output part
    var element = $('#rich-element .control-group').clone().show();
    element.prepend($('#control-group-buttons .btn-group').clone());
    $('#output').append(element);
    $('h3.instruction-title', element).tinymce({
      inline: true,
      toolbar: "undo redo",
      menubar: false
    });
    $('.instruction-content', element).tinymce({
      inline: true,
      plugins: ["advlist autolink lists link image charmap print preview anchor", "searchreplace visualblocks code fullscreen", "insertdatetime media table contextmenu paste"],
      toolbar: "insertfile undo redo | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image",
      menubar: false
    });
    e.preventDefault();
  });

  $('#add-hold').click(function(e){
    cleanko();
    $('#add-item-form').empty();
    $('#add-item-form').show();
    var legend = $('#legend legend').clone().text('Add hold point').show();
    var hold = $('#hold .control-group').clone().show();
    var button = $('#button .form-actions').clone().show();
    $('#add-item-form').append(legend);
    $('#add-item-form').append(hold);
    $('#add-item-form').append(button);

    // the output part
    var element = $('#hold-element .control-group').clone().show();
    element.prepend($('#control-group-buttons .btn-group').clone());
    $('#output').append(element);
    $('input', hold).attr("data-bind", "value: label, valueUpdate: 'afterkeydown'");
    $('.holder span', element).attr("data-bind", "text: label");
    var formModel = function (init) {
      this.label = ko.observable(init);
    };
    ko.applyBindings(new formModel("Name"));
    bindingButton();
    e.preventDefault();
  });

  $('#add-page').click(function(e){
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

function bindingButton () {
  $('#add-item-form button[type="submit"]').click(function(e){
    cleanko();
    $('#add-item-form').hide();
    e.preventDefault();
  });
  $('#add-item-form button[type="button"]').click(function(e){
    cleanko();
    $('#add-item-form').hide();
    $('#output .control-group').last().remove();
    e.preventDefault(e);
  });
}