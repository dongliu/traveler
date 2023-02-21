(function() {
  var root = this,
    exports = {};

  // The jade runtime:
  var jade = (exports.jade = (function(exports) {
    Array.isArray ||
      (Array.isArray = function(arr) {
        return '[object Array]' == Object.prototype.toString.call(arr);
      }),
      Object.keys ||
        (Object.keys = function(obj) {
          var arr = [];
          for (var key in obj) obj.hasOwnProperty(key) && arr.push(key);
          return arr;
        }),
      (exports.merge = function merge(a, b) {
        var ac = a['class'],
          bc = b['class'];
        if (ac || bc)
          (ac = ac || []),
            (bc = bc || []),
            Array.isArray(ac) || (ac = [ac]),
            Array.isArray(bc) || (bc = [bc]),
            (ac = ac.filter(nulls)),
            (bc = bc.filter(nulls)),
            (a['class'] = ac.concat(bc).join(' '));
        for (var key in b) key != 'class' && (a[key] = b[key]);
        return a;
      });
    function nulls(val) {
      return val != null;
    }
    return (
      (exports.attrs = function attrs(obj, escaped) {
        var buf = [],
          terse = obj.terse;
        delete obj.terse;
        var keys = Object.keys(obj),
          len = keys.length;
        if (len) {
          buf.push('');
          for (var i = 0; i < len; ++i) {
            var key = keys[i],
              val = obj[key];
            'boolean' == typeof val || null == val
              ? val &&
                (terse ? buf.push(key) : buf.push(key + '="' + key + '"'))
              : 0 == key.indexOf('data') && 'string' != typeof val
              ? buf.push(key + "='" + JSON.stringify(val) + "'")
              : 'class' == key && Array.isArray(val)
              ? buf.push(key + '="' + exports.escape(val.join(' ')) + '"')
              : escaped && escaped[key]
              ? buf.push(key + '="' + exports.escape(val) + '"')
              : buf.push(key + '="' + val + '"');
          }
        }
        return buf.join(' ');
      }),
      (exports.escape = function escape(html) {
        return String(html)
          .replace(/&(?!(\w+|\#\d+);)/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }),
      (exports.rethrow = function rethrow(err, filename, lineno) {
        if (!filename) throw err;
        var context = 3,
          str = require('fs').readFileSync(filename, 'utf8'),
          lines = str.split('\n'),
          start = Math.max(lineno - context, 0),
          end = Math.min(lines.length, lineno + context),
          context = lines
            .slice(start, end)
            .map(function(line, i) {
              var curr = i + start + 1;
              return (curr == lineno ? '  > ' : '    ') + curr + '| ' + line;
            })
            .join('\n');
        throw ((err.path = filename),
        (err.message =
          (filename || 'Jade') +
          ':' +
          lineno +
          '\n' +
          context +
          '\n\n' +
          err.message),
        err);
      }),
      exports
    );
  })({}));

  // create our folder objects

  // add_radio_button.jade compiled template
  exports['add_radio_button'] = function tmpl_add_radio_button() {
    return '<div class="control-group"><div class="control-label">Add Radio Button</div><div class="controls"><button value="add_radio_button" class="btn btn-primary">+</button></div></div>';
  };

  // alt.jade compiled template
  exports['alt'] = function tmpl_alt() {
    return '<div class="control-group"><div class="control-label">Image alternate text</div><div class="controls"><input type="text" disabled="disabled" name="alt"/></div></div>';
  };

  // checkbox_text.jade compiled template
  exports['checkbox_text'] = function tmpl_checkbox_text() {
    return '<div class="control-group"><div class="control-label">Text</div><div class="controls"><input type="text" name="checkbox_text"/></div></div>';
  };

  // done.jade compiled template
  exports['done'] = function tmpl_done() {
    return '<div class="control-group"><div class="controls"><button type="submit" class="btn btn-primary">Done</button></div></div>';
  };

  // figcaption.jade compiled template
  exports['figcaption'] = function tmpl_figcaption() {
    return '<div class="control-group"><div class="control-label">Figure caption</div><div class="controls"><input type="text" disabled="disabled" name="figcaption"/></div></div>';
  };

  // generic_text_input.jade compiled template
  exports['generic_text_input'] = function tmpl_generic_text_input(locals) {
    var buf = [];
    var locals_ = locals || {},
      label = locals_.label;
    buf.push(
      '<div class="control-group"><div class="control-label">' +
        jade.escape((jade.interp = label) == null ? '' : jade.interp) +
        '</div><div class="controls"><input type="text" name="radio_text"/></div></div>'
    );
    return buf.join('');
  };

  // height.jade compiled template
  exports['height'] = function tmpl_height() {
    return '<div class="control-group"><div class="control-label">Height</div><div class="controls"><input type="number" disabled="disabled" name="height" step="any"/></div></div>';
  };

  // help.jade compiled template
  exports['help'] = function tmpl_help() {
    return '<div class="control-group"><div class="control-label">Help</div><div class="controls"><input type="text" name="help"/></div></div>';
  };

  // hold.jade compiled template
  exports['hold'] = function tmpl_hold() {
    return '<div class="control-group"><div class="control-label">Holder</div><div class="controls"><input type="text" placeholder="Hold owner" name="holder"/></div></div>';
  };

  // imagefile.jade compiled template
  exports['imagefile'] = function tmpl_imagefile() {
    return '<div class="control-group"><div class="control-label">Select an image</div><div class="controls"><input name="userimage" type="file"/></div></div>';
  };

  // inputtype.jade compiled template
  exports['inputtype'] = function tmpl_inputtype() {
    return '<option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="datetime-local">Date Time</option><option value="email">Email</option><option value="tel">Phone number</option><option value="time">Time</option><option value="url">URL</option>';
  };

  // label.jade compiled template
  exports['label'] = function tmpl_label() {
    return '<div class="control-group"><div class="control-label">Label</div><div class="controls"><input type="text" name="label"/><span class="help-inline"> Keep the label brief and unique</span></div></div>';
  };

  // legend.jade compiled template
  exports['legend'] = function tmpl_legend() {
    return '<div class="control-group"><div class="control-label">Section legend</div><div class="controls"><input type="text" name="legend"/></div></div>';
  };

  // max.jade compiled template
  exports['max'] = function tmpl_max() {
    return '<div class="control-group"><div class="control-label">Max</div><div class="controls"><input type="number" name="max" step="any"/></div></div>';
  };

  // min.jade compiled template
  exports['min'] = function tmpl_min() {
    return '<div class="control-group"><div class="control-label">Min</div><div class="controls"><input type="number" name="min" step="any"/></div></div>';
  };

  // placeholder.jade compiled template
  exports['placeholder'] = function tmpl_placeholder() {
    return '<div class="control-group"><div class="control-label">Placeholder</div><div class="controls"><input type="text" name="placeholder"/></div></div>';
  };

  // required.jade compiled template
  exports['required'] = function tmpl_required() {
    return '<div class="control-group"><div class="control-label">Required</div><div class="controls"><label class="checkbox"><input type="checkbox" name="required"/><span>required</span></label></div></div>';
  };

  // rich_textarea.jade compiled template
  exports['rich_textarea'] = function tmpl_rich_textarea() {
    return '<div class="control-group"><div class="control-label">Rich editor</div><div class="controls"><textarea rows="10" class="tinymce"></textarea></div></div>';
  };

  // rows.jade compiled template
  exports['rows'] = function tmpl_rows() {
    return '<div class="control-group"><div class="control-label">Row</div><div class="controls"><input type="number" placeholder="Number of rows" name="rows"/></div></div>';
  };

  // type.jade compiled template
  exports['type'] = function tmpl_type() {
    return '<div class="control-group"><div class="control-label">Type</div><div class="controls"><select name="type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="datetime-local">Date Time</option><option value="email">Email</option><option value="tel">Phone number</option><option value="time">Time</option><option value="url">URL</option></select></div></div>';
  };

  // unit.jade compiled template
  exports['unit'] = function tmpl_unit() {
    return '<div class="control-group"><div class="control-label">Unit</div><div class="controls"><input type="text" name="unit"/></div></div>';
  };

  // userkey.jade compiled template
  exports['userkey'] = function tmpl_userkey() {
    return '<div class="control-group"><div class="control-label">User defined key</div><div class="controls"><input type="text" name="userkey" pattern="[a-zA-Z_0-9]{1,30}"/><span class="help-inline">Only letter, number, and "_" allowed (Example: MagMeas_1)</span></div></div>';
  };

  // width.jade compiled template
  exports['width'] = function tmpl_width() {
    return '<div class="control-group"><div class="control-label">Width</div><div class="controls"><input type="number" disabled="disabled" name="width" step="any"/></div></div>';
  };

  // attach to window or export with commonJS
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = exports;
  } else if (typeof define === 'function' && define.amd) {
    define(exports);
  } else {
    root.spec = exports;
  }
})();
