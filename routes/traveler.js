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

  app.get('/travelers/json', auth.ensureAuthenticated, function(req, res) {
    Traveler.find({
      createdBy: req.session.userid
    }, 'title description status devices sharedWith createdOn updatedOn updatedBy').lean().exec(function(err, docs) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      res.json(200, docs);
    });
  });


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

  app.get('/travelers/:id/json', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id).lean().exec(function(err, doc) {
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

  app.get('/travelers/:id/config', auth.ensureAuthenticated, function(req, res) {
    Traveler.findById(req.params.id, 'title description status devices sharedWith createdBy createdOn updatedOn updatedBy').lean().exec(function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        if (doc.createdBy == req.session.userid) {
          return res.render('config', doc);
        } else {
          return res.res(403, 'You are not authorized to access this resource');
        }
      } else {
        return res.send(410, 'gone');
      }

    });
  });

  app.put('/travelers/:id/config', auth.ensureAuthenticated, filterBody(['title', 'description']), function(req, res) {
    Traveler.findById(req.params.id, function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        for (var k in req.body) {
          if (req.body.hasOwnProperty(k) && req.body[k] != null) {
            doc[k] = req.body[k];
          }
        }
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function(err) {
          if (err) {
            console.error(err.msg);
            return res.send(500, err.msg);
          } else {
            return res.send(204);
          }
        });
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.post('/travelers/:id/devices/', auth.ensureAuthenticated, filterBody(['newdevice']), function(req, res) {
    Traveler.findByIdAndUpdate(req.params.id, {$addToSet: {devices: req.body.newdevice}, $set: {updatedBy: req.session.userid, updatedOn: Date.now()}}, function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        res.send(201, 'The device ' + req.body.newdevice + ' was added to the list.');
      } else {
        return res.send(410, 'gone');
      }
    });
  });

  app.delete('/travelers/:id/devices/:number', auth.ensureAuthenticated, function(req, res) {
    Traveler.findByIdAndUpdate(req.params.id, {$pull: {devices: req.params.number, $set: {updatedBy: req.session.userid, updatedOn: Date.now()}} }, function(err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (doc) {
        res.send(204);
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


function filterBody(strings) {
  return function(req, res, next) {
    var found = false;
    for (var k in req.body) {
      if (strings.indexOf(k) !== -1) {
        found = true;
      } else {
        req.body[k] = null;
      }
    }
    if (found) {
      next();
    } else {
      return res.send(400, 'cannot find required information in body');
    }
  };
}