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

  // button.jade compiled template
  exports['button'] = function tmpl_button() {
    return '<div class="pull-right control-group-buttons"><div class="btn-group"><a data-toggle="tooltip" title="edit" class="btn btn-info"><i class="fa fa-edit fa-lg"></i></a><a data-toggle="tooltip" title="duplicate" class="btn btn-info"><i class="fa fa-copy fa-lg"></i></a><a data-toggle="tooltip" title="remove" class="btn btn-warning"><i class="fa fa-trash-o fa-lg"></i></a></div></div>';
  };

  // checkbox.jade compiled template
  exports['checkbox'] = function tmpl_checkbox(locals) {
    var buf = [];
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade.interp = ' ') ? '' : jade.interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><label class="checkbox"><input type="checkbox" disabled="disabled" rv-required="model.required" rv-data-userkey="model.userkey"/><span>{ model.checkbox_text }</span></label></div></div>'
    );
    return buf.join('');
  };

  // figure.jade compiled template
  exports['figure'] = function tmpl_figure() {
    return '<div class="control-group output-control-group"><div class="controls"><figure><img src="" rv-alt="model.alt" rv-height="model.height" rv-width="model.width"/><figcaption>{ model.figcaption }</figcaption></figure></div></div>';
  };

  // hold.jade compiled template
  exports['hold'] = function tmpl_hold() {
    return '<div class="control-group output-control-group"><h4 class="holder">The flow is currently hold by&nbsp;<span>{ model.holder }</span></h4><div class="form-actions"><button type="submit" class="btn btn-primary">Continue</button></div></div>';
  };

  // number.jade compiled template
  exports['number'] = function tmpl_number(locals) {
    var buf = [];
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade.interp = ' ') ? '' : jade.interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><input type="number" disabled="disabled" rv-placeholder="model.placeholder" rv-required="model.required" rv-data-userkey="model.userkey" rv-min="model.min" rv-max="model.max" step="any"/><span rv-if="model.range" class="help-inline">{ model.range }</span><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // numberunit.jade compiled template
  exports['numberunit'] = function tmpl_numberunit() {
    return '<div class="control-group output-control-group"><div class="control-label"><span>{ model.label }</span></div><div class="controls"><div class="input-append"><input type="text" disabled="disabled" rv-placeholder="model.placeholder"/><span class="add-on">{ model.unit }</span></div><span class="help-block"></span></div></div>';
  };

  // other.jade compiled template
  exports['other'] = function tmpl_other() {
    return '<div class="control-group output-control-group"><div class="control-label"><span>{ model.label }</span></div><div class="controls"><input rv-type="model.type" disabled="disabled" rv-placeholder="model.placeholder" rv-required="model.required" rv-data-userkey="model.userkey"/><span class="help-block">{ model.help }</span></div></div>';
  };

  // radio_button.jade compiled template
  exports['radio_button'] = function tmpl_radio_button() {
    return '<label class="radio"><input type="radio" rv-value="model.radio_text" disabled="disabled" rv-name="model.name" rv-required="model.required" rv-data-userkey="model.userkey"/><span class="radio_text">{ model.radio_text }</span></label>';
  };

  // radiogroup.jade compiled template
  exports['radiogroup'] = function tmpl_radiogroup(locals) {
    var buf = [];
    buf.push(
      '<div rv-data-required="model.required" rv-data-userkey="model.userkey" class="control-group radio-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade.interp = ' ') ? '' : jade.interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"></div></div>'
    );
    return buf.join('');
  };

  // rich.jade compiled template
  exports['rich'] = function tmpl_rich() {
    return '<div class="control-group output-control-group"><div class="tinymce"></div></div>';
  };

  // section.jade compiled template
  exports['section'] = function tmpl_section(locals) {
    var buf = [];
    buf.push(
      '<div class="control-group output-control-group"><legend> <span class="section-number"></span>' +
        (null == (jade.interp = ' ') ? '' : jade.interp) +
        '<span class="label-text">{ model.legend }</span></legend></div>'
    );
    return buf.join('');
  };

  // text.jade compiled template
  exports['text'] = function tmpl_text(locals) {
    var buf = [];
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade.interp = ' ') ? '' : jade.interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><input type="text" disabled="disabled" rv-placeholder="model.placeholder" rv-required="model.required" rv-data-userkey="model.userkey"/><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // textarea.jade compiled template
  exports['textarea'] = function tmpl_textarea(locals) {
    var buf = [];
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade.interp = ' ') ? '' : jade.interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><textarea disabled="disabled" rv-placeholder="model.placeholder" rv-rows="model.rows" rv-required="model.required" rv-data-userkey="model.userkey"></textarea><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // upload.jade compiled template
  exports['upload'] = function tmpl_upload(locals) {
    var buf = [];
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade.interp = ' ') ? '' : jade.interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><input type="file" rv-required="model.required" rv-data-userkey="model.userkey" disabled="disabled"/><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // attach to window or export with commonJS
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = exports;
  } else if (typeof define === 'function' && define.amd) {
    define(exports);
  } else {
    root.input = exports;
  }
})();
