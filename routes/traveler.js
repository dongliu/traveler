var auth = require('../lib/auth');
var mongoose = require('mongoose');
var util = require('util');
var fs = require('fs');
var path = require('path');
var Busboy = require('busboy');
var pause = require('pause');
var u = require('underscore');
var cheer = require('cheerio');
// var sanitize = require('sanitize-caja'); // may need this later for new version of forms

var uploadsDir = '../uploads/';

var Form = mongoose.model('Form');
var User = mongoose.model('User');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerComment = mongoose.model('TravelerComment');


function createTraveler(form, req, res) {
  // update the total input number and finished input number
  var $ = cheer.load(form.html);
  var num = $('input, textarea').length;
  // console.log('total input number is ' + num);
  var traveler = new Traveler({
    title: form.title,
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
    comments: [],
    totalInput: num,
    finishedInput: 0
  });
  traveler.save(function (err, doc) {
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

function cloneTraveler(source, req, res) {
  var traveler = new Traveler({
    title: source.title,
    description: source.description,
    devices: [],
    status: 1,
    createdBy: source.createdBy,
    createdOn: Date.now(),
    clonedBy: req.session.userid,
    clonedFrom: source._id,
    sharedWith: source.sharedWith,
    referenceForm: source.referenceForm,
    forms: source.forms,
    data: [],
    comments: [],
    totalInput: source.totalInput,
    finishedInput: 0
  });
  traveler.save(function (err, doc) {
    if (err) {
      console.error(err.msg);
      return res.send(500, err.msg);
    }
    console.log('new traveler ' + doc.id + ' created');
    doc.sharedWith.forEach(function (e, i, a) {
      User.findByIdAndUpdate(e._id, {
        $addToSet: {
          travelers: doc._id
        }
      }, function (err, user) {
        if (err) {
          console.error(err.msg);
        }
        if (!user) {
          console.error('The user ' + e._id + ' does not in the db');
        }
      });
    });
    var url = req.protocol + '://' + req.get('host') + '/travelers/' + doc.id + '/';
    res.set('Location', url);
    return res.json(201, {
      location: '/travelers/' + doc.id + '/'
    });
  });
}

function filterBody(strings) {
  return function (req, res, next) {
    var k, found = false;
    for (k in req.body) {
      if (req.body.hasOwnProperty(k)) {
        if (strings.indexOf(k) !== -1) {
          found = true;
        } else {
          req.body[k] = null;
        }
      }
    }
    if (found) {
      next();
    } else {
      return res.send(400, 'cannot find required information in body');
    }
  };
}


function getSharedWith(sharedWith, name) {
  var i;
  if (sharedWith.length === 0) {
    return -1;
  }
  for (i = 0; i < sharedWith.length; i += 1) {
    if (sharedWith[i].username === name) {
      return i;
    }
  }
  return -1;
}

function addUser(req, res, doc) {
  var name = req.param('name');
  // check local db first then try ad
  User.findOne({
    name: name
  }, function (err, user) {
    if (err) {
      console.error(err.msg);
      return res.send(500, err.msg);
    }
    if (user) {
      var access = 0;
      if (req.param('access') && req.param('access') === 'write') {
        access = 1;
      }
      doc.sharedWith.addToSet({
        _id: user._id,
        username: name,
        access: access
      });
      doc.save(function (err) {
        if (err) {
          console.error(err.msg);
          res.send(500, err.msg);
        } else {
          res.send(201, 'The user named ' + name + ' was added to the share list.');
        }
      });
      user.update({
        $addToSet: {
          travelers: doc._id
        }
      }, function (err) {
        if (err) {
          console.error(err.msg);
        }
      });
    } else {
      res.send(500, 'cannot find user');
    }
  });
}

function canWrite(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return true;
  }
  if (doc.sharedWith.id(req.session.userid) && doc.sharedWith.id(req.session.userid).access === 1) {
    return true;
  }
  return false;
}

function canRead(req, doc) {
  if (doc.createdBy === req.session.userid) {
    return true;
  }
  if (doc.sharedWith.id(req.session.userid)) {
    return true;
  }
  return false;
}

// var gri, ha, generateShort;
/**
 * Returns an unsigned x-bit random integer.
 * @param {int} x A positive integer ranging from 0 to 53, inclusive.
 * @returns {int} An unsigned x-bit random integer (0 <= f(x) < 2^x).
 */
function gri(x) { // _getRandomInt
  if (x < 0) {
    return NaN;
  }
  if (x <= 30) {
    return (0 | Math.random() * (1 << x));
  }
  if (x <= 53) {
    return (0 | Math.random() * (1 << 30)) + (0 | Math.random() * (1 << x - 30)) * (1 << 30);
  }
  return NaN;
}

/**
 * Converts an integer to a zero-filled hexadecimal string.
 * @param {int} num
 * @param {int} length
 * @returns {string}
 */
function ha(num, length) { // _hexAligner
  var str = num.toString(16),
    i,
    z = "0";
  for (i = length - str.length; i > 0; i >>>= 1, z += z) {
    if (i & 1) {
      str = z + str;
    }
  }
  return str;
}

/*a short uid*/

function generateShort() {
  var rand = gri,
    hex = ha;
  return hex(rand(32), 8);
}

module.exports = function (app) {

  app.get('/travelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      createdBy: req.session.userid,
      archived: {
        $ne: true
      }
    }, 'title description status devices sharedWith clonedBy createdOn deadline updatedOn updatedBy finishedInput totalInput').lean().exec(function (err, docs) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      return res.json(200, docs);
    });
  });

  app.get('/sharedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    User.findOne({
      _id: req.session.userid
    }, 'travelers').lean().exec(function (err, me) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!me) {
        return res.send(400, 'cannot identify the current user');
      }
      Traveler.find({
        _id: {
          $in: me.travelers
        },
        archived: {
          $ne: true
        }
      }, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith finishedInput totalInput').lean().exec(function (err, travelers) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.json(200, travelers);
      });
    });
  });

  app.get('/currenttravelers/json', auth.ensureAuthenticated, function (req, res) {
    var device = req.query.device;
    var search = {
      archived: {
        $ne: true
      }
    };
    if (device) {
      search.devices = {$in: [device]};
    }
    Traveler.find(search, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      return res.json(200, travelers);
    });
  });

  app.get('/currenttravelers/', auth.ensureAuthenticated, function (req, res) {
    return res.render('currenttravelers', {device: req.query.device});
  });

  app.get('/archivedtravelers/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.find({
      createdBy: req.session.userid,
      archived: true
    }, 'title status devices createdBy createdOn deadline updatedBy updatedOn sharedWith finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      return res.json(200, travelers);
    });
  });

  app.post('/travelers/', auth.ensureAuthenticated, filterBody(['form', 'source']), function (req, res) {
    if (req.body.form) {
      Form.findById(req.body.form, function (err, form) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        if (form) {
          if (form.createdBy === req.session.userid) {
            createTraveler(form, req, res);
          } else {
            return res.send(400, 'You cannot create a traveler based on a form that you do not own.');
          }
        } else {
          return res.send(400, 'cannot find the form ' + req.body.form);
        }
      });
    }
    if (req.body.source) {
      Traveler.findById(req.body.source, function (err, traveler) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        if (traveler) {
          if (traveler.status == 0) {
            return res.send(400, 'You cannot clone an initialized traveler.');
          }
          if (canWrite(req, traveler)) {
            cloneTraveler(traveler, req, res);
          } else {
            return res.send(400, 'You cannot clone a traveler that you cannot write.');
          }
        } else {
          return res.send(400, 'cannot find the traveler ' + req.body.source);
        }
      });
    }
  });

  app.get('/travelers/:id/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (canWrite(req, doc)) {
        return res.render('traveler', doc);
      }
      return res.redirect('/travelers/' + req.params.id + '/view');
    });
  });

  app.get('/travelers/:id/view', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      return res.render('travelerviewer', doc);
    });
  });

  app.get('/travelers/:id/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      // if (!canRead(req, doc)) {
      //   return res.send(403, 'You are not authorized to access this resource');
      // }
      return res.json(200, doc);
    });
  });

  app.put('/travelers/:id/archived', auth.ensureAuthenticated, filterBody(['archived']), function (req, res) {
    Traveler.findById(req.params.id, 'createdBy archived').exec(function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (doc.createdBy !== req.session.userid) {
        return res.send(403, 'You are not authorized to access this resource');
      }

      if (doc.archived === req.body.archived) {
        return res.send(204);
      }

      doc.archived = req.body.archived;

      doc.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.send(204);
      })

    });
  })

  app.get('/travelers/:id/config', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, 'title description deadline status devices sharedWith createdBy createdOn updatedOn updatedBy').exec(function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (canWrite(req, doc)) {
        return res.render('config', doc);
      }
      return res.send(403, 'You are not authorized to access this resource');
    });
  });

  app.put('/travelers/:id/config', auth.ensureAuthenticated, filterBody(['title', 'description', 'deadline']), function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      var k;
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      for (k in req.body) {
        if (req.body.hasOwnProperty(k) && req.body[k] !== null) {
          doc[k] = req.body[k];
        }
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.send(204);
      });
    });
  });

  app.put('/travelers/:id/status', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }

      if (req.body.status === 1.5) {
        if (!canWrite(req, doc)) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      } else {
        if (doc.createdBy !== req.session.userid) {
          return res.send(403, 'You are not authorized to access this resource');
        }
      }

      if (req.body.status === 1) {
        if ([0, 1.5, 3].indexOf(doc.status) !== -1) {
          doc.status = 1;
        } else {
          return res.send(400, 'cannot start to work from the current status');
        }
      }

      if (req.body.status === 1.5) {
        if ([1].indexOf(doc.status) !== -1) {
          doc.status = 1.5;
        } else {
          return res.send(400, 'cannot complete from the current status');
        }
      }

      if (req.body.status === 2) {
        if ([1, 1.5].indexOf(doc.status) !== -1) {
          doc.status = 2;
        } else {
          return res.send(400, 'cannot complete from the current status');
        }
      }

      if (req.body.status === 3) {
        if ([1].indexOf(doc.status) !== -1) {
          doc.status = 3;
        } else {
          return res.send(400, 'cannot freeze from the current status');
        }
      }

      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.send(204);
      });
    });
  });


  app.post('/travelers/:id/devices/', auth.ensureAuthenticated, filterBody(['newdevice']), function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.devices.addToSet(req.body.newdevice);
      doc.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.send(204);
      });
    });
  });

  app.delete('/travelers/:id/devices/:number', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource');
      }
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.devices.pull(req.params.number);
      doc.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.send(204);
      });
    });
  });

  app.get('/travelers/:id/data/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      // if (!canRead(req, doc)) {
      //   return res.send(403, 'You are not authorized to access this resource');
      // }
      TravelerData.find({
        _id: {
          $in: doc.data
        }
      }, 'name value inputType inputBy inputOn').lean().exec(function (err, docs) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.json(200, docs);
      });
    });
  });

  app.post('/travelers/:id/data/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }
      var data = new TravelerData({
        traveler: doc._id,
        name: req.body.name,
        value: req.body.value,
        inputType: req.body.type,
        inputBy: req.session.userid,
        inputOn: Date.now()
      });
      data.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        doc.data.push(data._id);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err.msg);
            return res.send(500, err.msg);
          }
          return res.send(204);
        });
      });
    });
  });

  app.put('/travelers/:id/finishedinput', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }

      if (!req.body.hasOwnProperty('finishedInput')) {
        return res.send(400, 'need finished input number');
      }

      doc.update({
        finishedInput: req.body.finishedInput
      }, function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.send(204);
      });
    });
  });

  app.post('/travelers/:id/uploads/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      if (!canWrite(req, doc)) {
        return res.send(403, 'You are not authorized to access this resource.');
      }

      if (doc.status !== 1) {
        return res.send(400, 'The traveler ' + req.params.id + ' is not active');
      }

      // console.info(req.files);

      if (u.isEmpty(req.files)) {
        return res.send(400, 'Expecte One uploaded file');
      }

      var data = new TravelerData({
        traveler: doc._id,
        name: req.body.name,
        value: req.files[req.body.name].name,
        file: {
          path: req.files[req.body.name].path,
          encoding: req.files[req.body.name].encoding,
          mimetype: req.files[req.body.name].type
        },
        inputType: req.body.type,
        inputBy: req.session.userid,
        inputOn: Date.now()
      });

      // console.dir(data);
      data.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        doc.data.push(data._id);
        doc.updatedBy = req.session.userid;
        doc.updatedOn = Date.now();
        doc.save(function (err) {
          if (err) {
            console.error(err.msg);
            return res.send(500, err.msg);
          }
          var url = req.protocol + '://' + req.get('host') + '/data/' + data._id;
          res.set('Location', url);
          return res.json(201, {
            location: '/data/' + data._id
          });
        });
      });
    });
  });

  app.get('/data/:id', auth.ensureAuthenticated, function (req, res) {
    TravelerData.findById(req.params.id).lean().exec(function (err, data) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!data) {
        return res.send(410, 'gone');
      }
      if (data.inputType === 'file') {
        res.sendfile(data.file.path);
      } else {
        res.json(200, data);
      }
    });
  });

  app.get('/travelers/:id/share/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id).lean().exec(function (err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.render('share', {
        type: 'Traveler',
        id: req.params.id,
        title: traveler.title
      });
    });
  });

  app.get('/travelers/:id/share/json', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id).lean().exec(function (err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      return res.json(200, traveler.sharedWith || []);
    });
  });

  app.post('/travelers/:id/share/', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = getSharedWith(traveler.sharedWith, req.param.name);
      if (share === -1) {
        addUser(req, res, traveler);
      } else {
        // the user cannot be changed in this way
        return res.send(400, 'The user named ' + req.param.name + ' is already in the list.');
      }
    });
  });


  app.put('/travelers/:id/share/:userid', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = traveler.sharedWith.id(req.params.userid);
      if (!share) {
        return res.send(400, 'cannot find the user ' + req.params.userid);
      }
      // change the access
      if (req.body.access && req.body.access === 'write') {
        share.access = 1;
      } else {
        share.access = 0;
      }
      traveler.save(function (err) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        // check consistency of user's traveler list
        User.findByIdAndUpdate(req.params.userid, {
          $addToSet: {
            travelers: traveler._id
          }
        }, function (err, user) {
          if (err) {
            console.error(err.msg);
          }
          if (!user) {
            console.error('The user ' + req.params.userid + ' does not in the db');
          }
        });
        return res.send(204);
      });
    });
  });

  app.delete('/travelers/:id/share/:userid', auth.ensureAuthenticated, function (req, res) {
    Traveler.findById(req.params.id, function (err, traveler) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!traveler) {
        return res.send(410, 'gone');
      }
      if (traveler.createdBy !== req.session.userid) {
        return res.send(403, 'you are not authorized to access this resource');
      }
      var share = traveler.sharedWith.id(req.params.userid);
      if (share) {
        share.remove();
        traveler.save(function (err) {
          if (err) {
            console.error(err.msg);
            return res.send(500, err.msg);
          }
          // keep the consistency of user's traveler list
          User.findByIdAndUpdate(req.params.userid, {
            $pull: {
              travelers: traveler._id
            }
          }, function (err, user) {
            if (err) {
              console.error(err.msg);
            }
            if (!user) {
              console.error('The user ' + req.params.userid + ' does not in the db');
            }
          });
          return res.send(204);
        });
      } else {
        return res.send(400, 'no share info found for ' + req.params.userid);
      }
    });
  });

};
