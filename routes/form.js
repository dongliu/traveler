var auth = require('../lib/auth');
var mongoose = require('mongoose');
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
            html: form.html
          });
        }
        if (form.read.indexOf(req.session.userid) !== -1) {
          return res.render('viewer', {
            html: form.html
          });
        }
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
    var form = req.body;
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


  app.get('/forms/:id', auth.ensureAuthenticated, function(req, res) {
    return res.render('builder', {
      id: req.params.id
    });
  });
};