const debug = require('debug')('traveler-note');
const mongoose = require('mongoose');
const _ = require('lodash');

const auth = require('../lib/auth');

const reqUtils = require('../lib/req-utils');

const TravelerNote = mongoose.model('TravelerNote');
const logger = require('../lib/loggers').getLogger();

module.exports = function(app) {
  app.put(
    '/traveler-notes/:id',
    auth.ensureAuthenticated,
    reqUtils.exist('id', TravelerNote),
    reqUtils.canWriteMw('id'),
    reqUtils.filter('body', ['value']),
    reqUtils.hasAll('body', ['value']),
    reqUtils.sanitize('body', ['value']),
    async function(req, res) {
      const note = req[req.params.id];
      note.value = req.body.value;
      // not update the inputBy but add an updateBy here in order to reserve the ownership
      note.updatedBy = req.session.userid;
      note.updatedOn = Date.now();
      try {
        await note.save();
        return res.status(200).json(note);
      } catch (error) {
        logger.error(error);
        return res.status(500).send(error.message);
      }
    }
  );

  app.delete(
    '/traveler-notes/:id',
    auth.ensureAuthenticated,
    reqUtils.exist('id', TravelerNote),
    reqUtils.canWriteMw('id'),
    async function(req, res) {
      try {
        await TravelerNote.findByIdAndDelete(req.params.id);
        res.status(204).send();
      } catch (error) {
        logger.error(error);
        res.status(500).send(error.message);
      }
    }
  );
};
