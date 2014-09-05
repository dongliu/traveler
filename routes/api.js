var fs = require('fs');
var mongoose = require('mongoose');
var util = require('util');

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
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      return res.json(200, travelers);
    });
  });

  app.get('/apis/travelers/:id/', function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      return res.json(200, doc);
    });
  });

  app.get('/apis/travelers/:id/data/', function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
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

  app.get('/apis/travelers/:id/notes/', function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
      }
      if (!doc) {
        return res.send(410, 'gone');
      }
      TravelerNote.find({
        _id: {
          $in: doc.notes
        }
      }, 'name value inputBy inputOn').lean().exec(function (err, docs) {
        if (err) {
          console.error(err.msg);
          return res.send(500, err.msg);
        }
        return res.json(200, docs);
      });
    });
  });

  app.get('/apis/data/:id/', function (req, res) {
    TravelerData.findById(req.params.id).lean().exec(function (err, data) {
      if (err) {
        console.error(err.msg);
        return res.send(500, err.msg);
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
  })

};
