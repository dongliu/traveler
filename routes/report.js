/*eslint max-nested-callbacks: [2, 4], complexity: [2, 20]*/

var auth = require('../lib/auth');
var mongoose = require('mongoose');
var underscore = require('underscore');
var reqUtils = require('../lib/req-utils');
var routesUtilities = require('../utilities/routes');
var jade = require('jade');

require('../model/binder.js');
var User = mongoose.model('User');
var Group = mongoose.model('Group');
var Binder = mongoose.model('Binder');
var Traveler = mongoose.model('Traveler');
var TravelerData = mongoose.model('TravelerData');

/**
 * get the traveler id list from the binder
 * @param  {Binder} binder [description]
 * @return {[String]}       traveler id list
 */
function getTid(binder) {
  var tid = [];
  binder.works.forEach(function (w) {
    if (w.refType === 'traveler') {
      tid.push(w._id);
    }
  });
  return tid;
}

module.exports = function (app) {

  app.get('/binders/:bid/report', auth.ensureAuthenticated, reqUtils.exist('bid', Binder), reqUtils.canReadMw('bid'), function (req, res) {
    var binder = req[req.params.bid];
    return res.render('report-binder', routesUtilities.getRenderObject(req, {binder: binder, tid: getTid(binder)}));
  });

};
