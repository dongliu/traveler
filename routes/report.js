/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

var auth = require('../lib/auth');
var routesUtilities = require('../utilities/routes');

require('../model/binder.js');

/**
 * get the traveler id list from the binder
 * @param  {Binder} binder [description]
 * @return {[String]}       traveler id list
 */
function getTid(binder) {
  var tid = [];
  binder.works.forEach(function(w) {
    if (w.refType === 'traveler') {
      tid.push(w._id);
    }
  });
  return tid;
}

module.exports = function(app) {
  app.post('/travelers/report/', auth.ensureAuthenticated, function(req, res) {
    return res.render(
      'report-travelers',
      routesUtilities.getRenderObject(req, { tid: req.body.travelers })
    );
  });
};
