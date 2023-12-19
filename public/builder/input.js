(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    if (typeof root === 'undefined' || root !== Object(root)) {
      throw new Error('templatizer: window does not exist or is not an object');
    }
    root.input = factory();
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

  // button.jade compiled template
  templatizer['button'] = function tmpl_button() {
    return '<div class="pull-right control-group-buttons"><div class="btn-group"><a data-toggle="tooltip" title="edit" class="btn btn-info"><i class="fa fa-edit fa-lg"></i></a><a data-toggle="tooltip" title="duplicate" class="btn btn-info"><i class="fa fa-copy fa-lg"></i></a><a data-toggle="tooltip" title="remove" class="btn btn-warning"><i class="fa fa-trash-o fa-lg"></i></a></div></div>';
  };

  // checkbox.jade compiled template
  templatizer['checkbox'] = function tmpl_checkbox(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><label class="checkbox"><input type="checkbox" disabled="disabled" rv-required="model.required" rv-data-userkey="model.userkey"/><span>{ model.checkbox_text }</span></label></div></div>'
    );
    return buf.join('');
  };

  // checkbox_in_set.jade compiled template
  templatizer['checkbox_in_set'] = function tmpl_checkbox_in_set() {
    return '<div class="control-group output-control-group"><div class="controls"><label class="checkbox"><input type="checkbox" disabled="disabled" rv-data-userkey="model.userkey"/><span>{ model.checkbox_text }</span></label></div></div>';
  };

  // checkbox_set.jade compiled template
  templatizer['checkbox_set'] = function tmpl_checkbox_set(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div class="control-group checkbox-set"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><div class="checkbox-set-controls"></div><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // checkbox_set_button.jade compiled template
  templatizer['checkbox_set_button'] = function tmpl_checkbox_set_button() {
    return '<div class="checkbox-set-buttons"><div class="btn-group"><a data-toggle="tooltip" title="edit the checkbox" class="btn btn-info">Edit</a><a data-toggle="tooltip" title="remove the checkbox" class="btn btn-warning">Remove</a></div></div>';
  };

  // figure.jade compiled template
  templatizer['figure'] = function tmpl_figure() {
    return '<div class="control-group output-control-group"><div class="controls"><figure><img src="" rv-alt="model.alt" rv-height="model.height" rv-width="model.width"/><figcaption>{ model.figcaption }</figcaption></figure></div></div>';
  };

  // hold.jade compiled template
  templatizer['hold'] = function tmpl_hold() {
    return '<div class="control-group output-control-group"><h4 class="holder">The flow is currently hold by&nbsp;<span>{ model.holder }</span></h4><div class="form-actions"><button type="submit" class="btn btn-primary">Continue</button></div></div>';
  };

  // number.jade compiled template
  templatizer['number'] = function tmpl_number(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><input type="number" disabled="disabled" rv-placeholder="model.placeholder" rv-required="model.required" rv-data-userkey="model.userkey" rv-min="model.min" rv-max="model.max" step="any"/><span rv-if="model.range" class="help-inline">{ model.range }</span><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // numberunit.jade compiled template
  templatizer['numberunit'] = function tmpl_numberunit() {
    return '<div class="control-group output-control-group"><div class="control-label"><span>{ model.label }</span></div><div class="controls"><div class="input-append"><input type="text" disabled="disabled" rv-placeholder="model.placeholder"/><span class="add-on">{ model.unit }</span></div><span class="help-block"></span></div></div>';
  };

  // other.jade compiled template
  templatizer['other'] = function tmpl_other() {
    return '<div class="control-group output-control-group"><div class="control-label"><span>{ model.label }</span></div><div class="controls"><input rv-type="model.type" disabled="disabled" rv-placeholder="model.placeholder" rv-required="model.required" rv-data-userkey="model.userkey"/><span class="help-block">{ model.help }</span></div></div>';
  };

  // radio_button.jade compiled template
  templatizer['radio_button'] = function tmpl_radio_button() {
    return '<label class="radio"><input type="radio" rv-value="model.radio_text" disabled="disabled" rv-name="model.name" rv-required="model.required" rv-data-userkey="model.userkey"/><span class="radio_text">{ model.radio_text }</span></label>';
  };

  // radiogroup.jade compiled template
  templatizer['radiogroup'] = function tmpl_radiogroup(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div rv-data-required="model.required" rv-data-userkey="model.userkey" class="control-group radio-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><div class="radios"></div><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // rich.jade compiled template
  templatizer['rich'] = function tmpl_rich() {
    return '<div class="control-group output-control-group"><div class="tinymce"></div></div>';
  };

  // section.jade compiled template
  templatizer['section'] = function tmpl_section(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div class="control-group output-control-group"><legend> <span class="section-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="label-text">{ model.legend }</span></legend></div>'
    );
    return buf.join('');
  };

  // text.jade compiled template
  templatizer['text'] = function tmpl_text(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><input type="text" disabled="disabled" rv-placeholder="model.placeholder" rv-required="model.required" rv-data-userkey="model.userkey"/><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // textarea.jade compiled template
  templatizer['textarea'] = function tmpl_textarea(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><textarea disabled="disabled" rv-placeholder="model.placeholder" rv-rows="model.rows" rv-required="model.required" rv-data-userkey="model.userkey"></textarea><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  // upload.jade compiled template
  templatizer['upload'] = function tmpl_upload(locals) {
    var buf = [];
    var jade_mixins = {};
    var jade_interp;
    buf.push(
      '<div class="control-group output-control-group"><div class="control-label"><span class="control-number"></span>' +
        (null == (jade_interp = ' ') ? '' : jade_interp) +
        '<span class="model-label">{ model.label }</span></div><div class="controls"><input type="file" rv-required="model.required" rv-data-userkey="model.userkey" rv-data-filetype="model.filetype" disabled="disabled"/><span class="help-block">{ model.help }</span></div></div>'
    );
    return buf.join('');
  };

  return templatizer;
});
