/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false, FormData: false, History: false */
$(function() {
  function updateH1m(start, messages) {
    return function() {
      $('#h1m').text(messages[start]);
      start += 1;
      if (start > messages.length - 1) {
        start = start % messages.length;
      }
    };
  }
  var messages = ['Work', 'Design', 'Organize', 'Collaborate'];
  window.setInterval(updateH1m(0, messages), 10 * 1000);
});
