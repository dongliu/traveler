function json2List(json) {
  var output = '<dl>';
  for (var k in json) {
    if (json.hasOwnProperty(k)) {
      if (typeof(json[k]) == 'object') {
        output = output + '<dl>' + '<dt>' + k + '</dt>' + '<dd>' + json2List(json[k]) + '</dd>' + '</dl>';
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
    var $affix = $('<ul class="nav nav-list nav-stacked affix bs-docs-sidenav" data-offset-top="0"></ul>');
    var i;
    if ($legend.length > 1) {
        $affix.append('<li><h4>' + title + '</h4></li>');
        for (i = 0; i < $legend.length; i += 1) {
            $affix.append('<li><a href="#' + $legend[i].id + '">' + $legend[i].textContent + '</a></li>');
        }
        $('.sidebar').append($('<div id="affixlist"></div>').append($affix));
        $('body').attr('data-spy', 'scroll');
        $('body').attr('data-target', '#affixlist');
    }
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