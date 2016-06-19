var fs = require('fs');
var mongoose = require('mongoose');
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
        return res.status(500).send(err.message);
      }
      return res.status(200).json(travelers);
    });
  });

  app.get('/apis/travelers/:id/', function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (!doc) {
        return res.status(410).send('gone');
      }
      return res.status(200).json(doc);
    });
  });

  app.get('/apis/travelers/:id/data/', function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (!doc) {
        return res.status(410).send('gone');
      }
      TravelerData.find({
        _id: {
          $in: doc.data
        }
      }, 'name value inputType inputBy inputOn').exec(function (err, docs) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        return res.status(200).json(docs);
      });
    });
  });

  app.get('/apis/travelers/:id/notes/', function (req, res) {
    Traveler.findById(req.params.id, function (err, doc) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (!doc) {
        return res.status(410).send('gone');
      }
      TravelerNote.find({
        _id: {
          $in: doc.notes
        }
      }, 'name value inputBy inputOn').exec(function (err, docs) {
        if (err) {
          console.error(err);
          return res.status(500).send(err.message);
        }
        return res.status(200).json(docs);
      });
    });
  });

  app.get('/apis/data/:id/', function (req, res) {
    TravelerData.findById(req.params.id).exec(function (err, data) {
      if (err) {
        console.error(err);
        return res.status(500).send(err.message);
      }
      if (!data) {
        return res.status(410).send('gone');
      }
      if (data.inputType === 'file') {
        fs.exists(data.file.path, function (exists) {
          if (exists) {
            return res.sendFile(data.file.path);
          }
          return res.status(410).send('gone');
        });
      } else {
        res.status(200).json(data);
      }
    });
  });

};
