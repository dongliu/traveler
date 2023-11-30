(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    if (typeof root === 'undefined' || root !== Object(root)) {
      throw new Error('templatizer: window does not exist or is not an object');
    }
    root.spec = factory();
  }
})(this, function() {
  var jade = (function() {
    function n(n) {
      return null != n && '' !== n;
    }
    function t(e) {
      return (Array.isArray(e)
        ? e.map(t)
        : e && 'object' == typeof e
        ? Object.keys(e).filter(function(n) {
            return e[n];
          })
        : [e]
      )
        .filter(n)
        .join(' ');
    }
    function e(n) {
      return i[n] || n;
    }
    function r(n) {
      var t = String(n).replace(o, e);
      return t === '' + n ? n : t;
    }
    var a = {};
    (a.merge = function t(e, r) {
      if (1 === arguments.length) {
        for (var a = e[0], i = 1; i < e.length; i++) a = t(a, e[i]);
        return a;
      }
      var o = e.class,
        s = r.class;
      (o || s) &&
        ((o = o || []),
        (s = s || []),
        Array.isArray(o) || (o = [o]),
        Array.isArray(s) || (s = [s]),
        (e.class = o.concat(s).filter(n)));
      for (var f in r) 'class' != f && (e[f] = r[f]);
      return e;
    }),
      (a.joinClasses = t),
      (a.cls = function(n, e) {
        for (var r = [], i = 0; i < n.length; i++)
          e && e[i] ? r.push(a.escape(t([n[i]]))) : r.push(t(n[i]));
        var o = t(r);
        return o.length ? ' class="' + o + '"' : '';
      }),
      (a.style = function(n) {
        return n && 'object' == typeof n
          ? Object.keys(n)
              .map(function(t) {
                return t + ':' + n[t];
              })
              .join(';')
          : n;
      }),
      (a.attr = function(n, t, e, r) {
        return (
          'style' === n && (t = a.style(t)),
          'boolean' == typeof t || null == t
            ? t
              ? ' ' + (r ? n : n + '="' + n + '"')
              : ''
            : 0 == n.indexOf('data') && 'string' != typeof t
            ? (-1 !== JSON.stringify(t).indexOf('&') &&
                console.warn(
                  'Since Jade 2.0.0, ampersands (`&`) in data attributes will be escaped to `&amp;`'
                ),
              t &&
                'function' == typeof t.toISOString &&
                console.warn(
                  'Jade will eliminate the double quotes around dates in ISO form after 2.0.0'
                ),
              ' ' + n + "='" + JSON.stringify(t).replace(/'/g, '&apos;') + "'")
            : e
            ? (t &&
                'function' == typeof t.toISOString &&
                console.warn(
                  'Jade will stringify dates in ISO form after 2.0.0'
                ),
              ' ' + n + '="' + a.escape(t) + '"')
            : (t &&
                'function' == typeof t.toISOString &&
                console.warn(
                  'Jade will stringify dates in ISO form after 2.0.0'
                ),
              ' ' + n + '="' + t + '"')
        );
      }),
      (a.attrs = function(n, e) {
        var r = [],
          i = Object.keys(n);
        if (i.length)
          for (var o = 0; o < i.length; ++o) {
            var s = i[o],
              f = n[s];
            'class' == s
              ? (f = t(f)) && r.push(' ' + s + '="' + f + '"')
              : r.push(a.attr(s, f, !1, e));
          }
        return r.join('');
      });
    var i = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' },
      o = /[&<>"]/g;
    return (
      (a.escape = r),
      (a.rethrow = function n(t, e, r, a) {
        if (!(t instanceof Error)) throw t;
        if (!(('undefined' == typeof window && e) || a))
          throw ((t.message += ' on line ' + r), t);
        try {
          a = a || require('fs').readFileSync(e, 'utf8');
        } catch (e) {
          n(t, null, r);
        }
        var i = 3,
          o = a.split('\n'),
          s = Math.max(r - i, 0),
          f = Math.min(o.length, r + i),
          i = o
            .slice(s, f)
            .map(function(n, t) {
              var e = t + s + 1;
              return (e == r ? '  > ' : '    ') + e + '| ' + n;
            })
            .join('\n');
        throw ((t.path = e),
        (t.message = (e || 'Jade') + ':' + r + '\n' + i + '\n\n' + t.message),
        t);
      }),
      (a.DebugItem = function(n, t) {
        (this.lineno = n), (this.filename = t);
      }),
      a
    );
  })();

  var templatizer = {};

  // add_checkbox_button.jade compiled template
  templatizer['add_checkbox_button'] = function tmpl_add_checkbox_button() {
    return '<div class="control-group"><div class="control-label">Add Checkbox</div><div class="controls"><button value="add_checkbox_button" class="btn btn-primary">+</button></div></div>';
  };

  // add_radio_button.jade compiled template
  templatizer['add_radio_button'] = function tmpl_add_radio_button() {
    return '<div class="control-group"><div class="control-label">Add Radio Button</div><div class="controls"><button value="add_radio_button" class="btn btn-primary">+</button></div></div>';
  };

  // alt.jade compiled template
  templatizer['alt'] = function tmpl_alt() {
    return '<div class="control-group"><div class="control-label">Image alternate text</div><div class="controls"><input type="text" disabled="disabled" name="alt"/></div></div>';
  };

  // checkbox_text.jade compiled template
  templatizer['checkbox_text'] = function tmpl_checkbox_text() {
    return '<div class="control-group"><div class="control-label">Text</div><div class="controls"><input type="text" name="checkbox_text"/></div></div>';
  };

  // done.jade compiled template
  templatizer['done'] = function tmpl_done() {
    return '<div class="control-group"><div class="controls"><button type="submit" class="btn btn-primary">Done</button></div></div>';
  };

  // figcaption.jade compiled template
  templatizer['figcaption'] = function tmpl_figcaption() {
    return '<div class="control-group"><div class="control-label">Figure caption</div><div class="controls"><input type="text" disabled="disabled" name="figcaption"/></div></div>';
  };

  // filetype.jade compiled template
  templatizer['filetype'] = function tmpl_filetype() {
    return '<div class="control-group"><div class="control-label">File type</div><div class="controls"><input type="text" name="filetype"/><span class="help">Leave blank for default file formats (PDF, excel & image/text formats). Specify for a specific file format (ex: zip)</span></div></div>';
  };

  // generic_text_input.jade compiled template
  templatizer['generic_text_input'] = function tmpl_generic_text_input(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    var locals_for_with = locals || {};
    (function(label) {
      buf.push(
        '<div class="control-group"><div class="control-label">' +
          jade.escape((jade_interp = label) == null ? '' : jade_interp) +
          '</div><div class="controls"><input type="text" name="radio_text"/></div></div>'
      );
    }.call(
      this,
      'label' in locals_for_with
        ? locals_for_with.label
        : typeof label !== 'undefined'
        ? label
        : undefined
    ));
    return buf.join('');
  };

  // height.jade compiled template
  templatizer['height'] = function tmpl_height() {
    return '<div class="control-group"><div class="control-label">Height</div><div class="controls"><input type="number" disabled="disabled" name="height" step="any"/></div></div>';
  };

  // help.jade compiled template
  templatizer['help'] = function tmpl_help() {
    return '<div class="control-group"><div class="control-label">Help</div><div class="controls"><input type="text" name="help"/></div></div>';
  };

  // hold.jade compiled template
  templatizer['hold'] = function tmpl_hold() {
    return '<div class="control-group"><div class="control-label">Holder</div><div class="controls"><input type="text" placeholder="Hold owner" name="holder"/></div></div>';
  };

  // imagefile.jade compiled template
  templatizer['imagefile'] = function tmpl_imagefile() {
    return '<div class="control-group"><div class="control-label">Select an image</div><div class="controls"><input name="userimage" type="file"/></div></div>';
  };

  // inputtype.jade compiled template
  templatizer['inputtype'] = function tmpl_inputtype() {
    return '<option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="datetime-local">Date Time</option><option value="email">Email</option><option value="tel">Phone number</option><option value="time">Time</option><option value="url">URL</option>';
  };

  // label.jade compiled template
  templatizer['label'] = function tmpl_label() {
    return '<div class="control-group"><div class="control-label">Label</div><div class="controls"><input type="text" name="label"/><span class="help-inline"> Keep the label brief and unique</span></div></div>';
  };

  // legend.jade compiled template
  templatizer['legend'] = function tmpl_legend() {
    return '<div class="control-group"><div class="control-label">Section legend</div><div class="controls"><input type="text" name="legend"/></div></div>';
  };

  // max.jade compiled template
  templatizer['max'] = function tmpl_max() {
    return '<div class="control-group"><div class="control-label">Max</div><div class="controls"><input type="number" name="max" step="any"/></div></div>';
  };

  // min.jade compiled template
  templatizer['min'] = function tmpl_min() {
    return '<div class="control-group"><div class="control-label">Min</div><div class="controls"><input type="number" name="min" step="any"/></div></div>';
  };

  // placeholder.jade compiled template
  templatizer['placeholder'] = function tmpl_placeholder() {
    return '<div class="control-group"><div class="control-label">Placeholder</div><div class="controls"><input type="text" name="placeholder"/></div></div>';
  };

  // required.jade compiled template
  templatizer['required'] = function tmpl_required() {
    return '<div class="control-group"><div class="control-label">Required</div><div class="controls"><label class="checkbox"><input type="checkbox" name="required"/><span>required</span></label></div></div>';
  };

  // rich_textarea.jade compiled template
  templatizer['rich_textarea'] = function tmpl_rich_textarea() {
    return '<div class="control-group"><div class="control-label">Rich editor</div><div class="controls"><textarea rows="10" class="tinymce"></textarea></div></div>';
  };

  // rows.jade compiled template
  templatizer['rows'] = function tmpl_rows() {
    return '<div class="control-group"><div class="control-label">Row</div><div class="controls"><input type="number" placeholder="Number of rows" name="rows"/></div></div>';
  };

  // type.jade compiled template
  templatizer['type'] = function tmpl_type() {
    return '<div class="control-group"><div class="control-label">Type</div><div class="controls"><select name="type"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="datetime-local">Date Time</option><option value="email">Email</option><option value="tel">Phone number</option><option value="time">Time</option><option value="url">URL</option></select></div></div>';
  };

  // unit.jade compiled template
  templatizer['unit'] = function tmpl_unit() {
    return '<div class="control-group"><div class="control-label">Unit</div><div class="controls"><input type="text" name="unit"/></div></div>';
  };

  // userkey.jade compiled template
  templatizer['userkey'] = function tmpl_userkey() {
    return '<div class="control-group"><div class="control-label">User defined key</div><div class="controls"><input type="text" name="userkey" pattern="[a-zA-Z_0-9]{1,30}"/><span class="help-inline">Only letter, number, and "_" allowed (Example: MagMeas_1)</span></div></div>';
  };

  // width.jade compiled template
  templatizer['width'] = function tmpl_width() {
    return '<div class="control-group"><div class="control-label">Width</div><div class="controls"><input type="number" disabled="disabled" name="width" step="any"/></div></div>';
  };

  return templatizer;
});
