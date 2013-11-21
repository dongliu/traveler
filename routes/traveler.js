var ad = require('../config/ad.json');
var ldapClient = require('../lib/ldap-client');

var auth = require('../lib/auth');
var mongoose = require('mongoose');
// var sanitize = require('sanitize-caja');
var util = require('util');


var Form = mongoose.model('Form');
var User = mongoose.model('User');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerComment = mongoose.model('TravelerComment');


module.exports = function(app) {
  app.post('/travelers/', auth.ensureAuthenticated, function(req, res) {
    if (!req.body.form) {
      return res.send(400, 'need the form in request');
    }
    Form.findById(req.body.form, function(err, form) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (form) {
        if (form.createdBy == req.session.userid) {
          createTraveler(form, req, res);
        } else {
          return res.send(400, 'You cannot create a traveler based on a form that you do not own');
        }
      } else {
        return res.send(400, 'cannot find the form ' + req.body.form);
      }
    });
  });

  app.get('/travelers/:id/json', auth.ensureAuthenticated, function(req, res){
    Traveler.findById(req.params.id).lean().exec(function(err, doc){
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        return res.json(200, doc);
      } else {
        return res.send(410, 'gone');
      }

    });
  });
};

function createTraveler(form, req, res) {
  var traveler = new Traveler({
    title: 'update me',
    description: '',
    devices: [],
    status: 0,
    createdBy: req.session.userid,
    createdOn: Date.now(),
    sharedWith: [],
    referenceForm: form._id,
    forms: [{
      html: form.html
    }],
    data: [],
    comments: []
  });
  traveler.save(function(err, doc) {
    if (err) {
      console.error(err.msg);
      return res.send(500, err.msg);
    }
    console.log('new traveler ' + doc.id + ' created');
    var url = req.protocol + '://' + req.get('host') + '/travelers/' + doc.id + '/';
    res.set('Location', url);
    return res.json(201, {
      location: '/travelers/' + doc.id + '/'
    });
  });
}