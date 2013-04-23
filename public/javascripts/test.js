// $(function() {
  var viewModel = function(init) {
    this.someValue = ko.observable(init);
  }

  // {
  //   someValue: ko.observable("edit me")
  // };

  ko.applyBindings(new viewModel("test"));

// };

