var auth = require('../lib/auth');
var mongoose = require('mongoose');
var sanitize = require('sanitize-caja');
var util = require('util');


var Form = mongoose.model('Form');

module.exports = function(app) {
  app.get('/forms/new', auth.ensureAuthenticated, function(req, res) {
    return res.render('builder');
  });

  app.get('/forms/:id', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id).lean().exec(function(err, form){
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.read.indexOf(req.session.userid) == -1 && form.write.indexOf(req.session.userid) == -1) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        if (form.write.indexOf(req.session.userid) !== -1) {
          return res.render('builder', {
            id: req.params.id,
            title: form.title,
            html: form.html
          });
        }
        if (form.read.indexOf(req.session.userid) !== -1) {
          return res.render('viewer', {
            id: req.params.id,
            title: form.title,
            html: form.html
          });
        }
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.get('/forms/:id/preview', auth.ensureAuthenticated, function(req, res) {
    Form.findById(req.params.id).lean().exec(function(err, form){
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.read.indexOf(req.session.userid) == -1 && form.write.indexOf(req.session.userid) == -1) {
          return res.send(403, 'you are not authorized to access this resource');
        }
        return res.render('viewer', {
          id: req.params.id,
          title: form.title,
          html: form.html
        });
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.post('/forms', auth.ensureAuthenticated, function(req, res) {
    if (!req.is('json')) {
      return res.send(415, 'json request expected');
    }
    if (!req.body.html) {
      return res.send(400, 'need html of the form');
    }
    var form = {};
    // form.html = sanitizer.sanitize(req.body.html);
    form.html = sanitize(req.body.html);
    // form.html = san.sanitiseHTML(req.body.html);
    // form.html = req.body.html;
    form.title = req.body.title;
    form.createdBy = req.session.userid;
    form.createdOn = Date.now();
    form.write = [];
    form.write.push(req.session.userid);
    (new Form(form)).save(function(err, newform) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      var url = req.protocol + '://' + req.get('host') + '/forms/' + newform.id;
      res.set('Location', url);
      return res.json(201, {location: '/forms/'+newform.id});
    });
  });

  app.put('/forms/:id', auth.ensureAuthenticated, function(req, res) {
    if (!req.is('json')) {
      return res.send(415, 'json request expected');
    }
    // if (!req.body.html) {
    //   return res.send(400, 'need html of the form');
    // }
    var form = {};
    if (req.body.html) {
      form.html = sanitize(req.body.html);
    }
    if (req.body.title) {
      form.title = req.body.title;
    }
    if (req.body.read && util.isArray(req.body.read)) {
      form.read = req.body.read;
    }
    if (req.body.write && util.isArray(req.body.write)) {
      form.write = req.body.write;
    }

    if (form.html || form.title || form.read || form.write) {
      form.updatedBy = req.session.userid;
      form.updatedOn = Date.now();
    } else {
      return res.send('400', 'no update details found');
    }

    Form.findByIdAndUpdate(req.params.id, form, function(err, old) {
      if (err) {
        console.dir(err);
        return res.send(500, err.msg || err.errmsg);
      }
      if (old) {
        return res.send(204);
      } else {
        return res.send(410, 'cannot find form ' + req.params.id);
      }
    });
  });


  app.get('/forms/:id', auth.ensureAuthenticated, function(req, res) {
    return res.render('builder', {
      id: req.params.id
    });
  });
};