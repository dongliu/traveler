/*global moment: false*/

function json2List(json) {
  var output = '<dl>';
  for (var k in json) {
    if (json.hasOwnProperty(k)) {
      if (typeof json[k] == 'object') {
        output =
          output +
          '<dl>' +
          '<dt>' +
          k +
          '</dt>' +
          '<dd>' +
          json2List(json[k]) +
          '</dd>' +
          '</dl>';
      } else {
        output = output + '<p><strong>' + k + '</strong> : ' + json[k] + '</p>';
      }
    }
  }
  output = output + '</dl>';
  return output;
}

function createSideNav() {
  $('.sidebar').empty();
  var $legend = $('legend');
  var $affix = $(
    '<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>'
  );
  var i;
  var nav_parent_id = 'nav-parent';
  var nav_list_child_class = 'nav-child';
  if ($legend.length > 1) {
    $affix.append(
      '<li id="' + nav_parent_id + '"><h4>' + title + '</h4><span></span></li>'
    );
    for (i = 0; i < $legend.length; i += 1) {
      $affix.append(
        '<li class="' +
          nav_list_child_class +
          '"><a href="#' +
          $legend[i].id +
          '">' +
          $legend[i].textContent +
          '</a></li>'
      );
    }
    $('.sidebar').append($('<div id="affixlist"></div>').append($affix));
    $('body').attr('data-spy', 'scroll');
    $('body').attr('data-target', '#affixlist');
  }

  var parent = document.getElementById(nav_parent_id);

  parent.addEventListener('click', function() {
    var header = document.getElementById(nav_parent_id);
    var expansion = header.getElementsByTagName('span')[0];

    var children = document.getElementsByClassName(nav_list_child_class);

    for (i = 0; i < children.length; i++) {
      var child = children[i];

      if (child.style.maxHeight) {
        child.style.maxHeight = null;
        expansion.innerHTML = '+';
      } else {
        child.style.maxHeight = child.scrollHeight + 'px';
        expansion.innerHTML = '-';
      }
    }
  });

  // Expand by default.
  parent.click();
}

function history(found) {
  var i;
  var output = '';
  if (found.length > 0) {
    for (i = 0; i < found.length; i += 1) {
      var inputType = found[i].inputType;
      var historyValue = found[i].value;
      var inputBy = found[i].inputBy;
      var inputOn = found[i].inputOn;
      output =
        output +
        generateHistoryRecordHtml(inputType, historyValue, inputBy, inputOn);
    }
  }
  return output;
}

function generateHistoryRecordHtml(
  type,
  historyValue,
  inputBy,
  inputOn,
  live = false
) {
  if (type === 'url') {
    if (historyValue !== null) {
      if (historyValue.startsWith('http') === false) {
        historyValue = 'http://' + historyValue;
      }
      historyValue =
        '<a target="_blank" href=' + historyValue + '>' + historyValue + '</a>';
    }
  }
  return (
    'changed to <strong>' +
    historyValue +
    '</strong> by ' +
    inputBy +
    ' ' +
    livespan(inputOn, live) +
    '; '
  );
}

function livespan(stamp, live = true) {
  if (live) {
    return '<span data-livestamp="' + stamp + '"></span>';
  } else {
    return (
      '<span>' + moment(stamp).format('MMM D YYYY, HH:mm:ss ZZ') + '</span>'
    );
  }
}

function findById(a, id) {
  var i;
  for (i = 0; i < a.length; i += 1) {
    if (a[i]._id === id) {
      return a[i];
    }
  }
  return null;
}

// function nameAuto(input, nameCache){
//   return {
//     minLength: 3,
//     source: function(req, res) {
//       var term = req.term.toLowerCase();
//       var output = [];
//       var key = term.charAt(0);
//       if (key in nameCache) {
//         for (var i = 0; i < nameCache[key].length; i += 1) {
//           if (nameCache[key][i].toLowerCase().indexOf(term) === 0) {
//             output.push(nameCache[key][i]);
//           }
//         }
//         res(output);
//         return;
//       }
//       $.getJSON('/adusernames', {term: key}, function(data, status, xhr) {
//         var names = [];
//         for (var i = 0; i < data.length; i += 1) {
//           if (data[i].displayName.indexOf(',') !== -1) {
//             names.push(data[i].displayName);
//           }
//         }
//         nameCache[term] = names;
//         res(names);
//       });
//     },
//     select: function(event, ui) {
//       $(input).val(ui.item.value);
//     }
//   };
// }
