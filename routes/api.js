var fs = require('fs');
var mongoose = require('mongoose');
var basic = require('basic-auth');
var routesUtilities = require('../utilities/routes.js');

// var Form = mongoose.model('Form');
// var User = mongoose.model('User');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');
var TravelerNote = mongoose.model('TravelerNote');

module.exports = function (app) {
  app.get('/apis/travelers/', function (req, res) {
    var search = {
      archived: {
        $ne: true
      }
    };
    if (req.query.hasOwnProperty('device')) {
      search.devices = {
        $in: [req.query.device]
      };
    }
    Traveler.find(search, 'title status devices createdBy clonedBy createdOn deadline updatedBy updatedOn sharedWith finishedInput totalInput').lean().exec(function (err, travelers) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      return res.json(200, travelers);
    });
  });

  app.get('/apis/travelers/:id/', function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      return res.json(200, doc);
    });
  });

  app.get('/apis/travelers/:id/data/', function (req, res) {
    Traveler.findById(req.params.id, function (travelerErr, doc) {
      if (travelerErr) {
        console.error(travelerErr);
        return res.send(500, travelerErr.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      TravelerData.find({
        _id: {
          $in: doc.data
        }
      }, 'name value inputType inputBy inputOn').lean().exec(function (travelerDataErr, docs) {
        if (travelerDataErr) {
          console.error(travelerDataErr);
          return res.send(500, travelerDataErr.message);
        }
        return res.json(200, docs);
      });
    });
  });

  app.get('/apis/travelers/:id/notes/', function (req, res) {
    Traveler.findById(req.params.id, function (travelerErr, doc) {
      if (travelerErr) {
        console.error(travelerErr);
        return res.send(500, travelerErr.message);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      TravelerNote.find({
        _id: {
          $in: doc.notes
        }
      }, 'name value inputBy inputOn').lean().exec(function (travelerNotesErr, notes) {
        if (travelerNotesErr) {
          console.error(travelerNotesErr);
          return res.send(500, travelerNotesErr.message);
        }
        return res.json(200, notes);
      });
    });
  });

  app.get('/apis/data/:id/', function (req, res) {
    TravelerData.findById(req.params.id).lean().exec(function (err, data) {
      if (err) {
        console.error(err);
        return res.send(500, err.message);
      }
      if (!data) {
        return res.send(410, 'gone');
      }
      if (data.inputType === 'file') {
        fs.exists(data.file.path, function (exists) {
          if (exists) {
            return res.sendfile(data.file.path);
          }
          return res.send(410, 'gone');
        });
      } else {
        res.json(200, data);
      }
    });
  });

  app.post('/apis/createForm/', routesUtilities.filterBody(['formName', 'userName', 'html'], true), function (req, res) {
    var credentials = basic(req);
    //User must have write access to perform addition of form
    if (credentials.name !== 'api_write') {
      return res.json(401, {
        error: 'Write permissions are needed to create a form'
      });
    }
    routesUtilities.form.createForm(req.body.formName, req.body.userName, req.body.html, function (err, newform) {
      if (err) {
        console.error(err);
        return res.json(500, err);
      } else {
        return res.json(201, newform);
      }
    });

  });
};
