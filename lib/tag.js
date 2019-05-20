var auth = require('./auth');
var reqUtils = require('./req-utils');

/**
 * add tag routine for model at uri
 * @param {Express} app   the express app
 * @param {String} uri    the uri for the route
 * @param {Model} model   the model object
 * @return {undefined}
 */
function addTag(app, uri, model) {
  app.post(
    uri,
    auth.ensureAuthenticated,
    reqUtils.exist('id', model),
    reqUtils.canWriteMw('id'),
    reqUtils.filter('body', ['newtag']),
    reqUtils.sanitize('body', ['newtag']),
    function(req, res) {
      var doc = req[req.params.id];
      var newtag = req.body.newtag;
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      var added = doc.tags.addToSet(newtag);
      if (added.length === 0) {
        return res.status(204).send();
      }
      doc.save(function(saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res.status(200).json({ tag: newtag });
      });
    }
  );
}

/**
 * remove tag routine for model at uri
 * @param  {Express} app   the express app
 * @param  {String} uri    the uri for the route
 * @param  {Model} model   the model object
 * @return {undefined}
 */
function removeTag(app, uri, model) {
  app.delete(
    uri,
    auth.ensureAuthenticated,
    reqUtils.exist('id', model),
    reqUtils.canWriteMw('id'),
    function(req, res) {
      var doc = req[req.params.id];
      doc.updatedBy = req.session.userid;
      doc.updatedOn = Date.now();
      doc.tags.pull(req.params.tag);
      doc.save(function(saveErr) {
        if (saveErr) {
          console.error(saveErr);
          return res.status(500).send(saveErr.message);
        }
        return res.status(204).send();
      });
    }
  );
}

module.exports = {
  addTag: addTag,
  removeTag: removeTag,
};
