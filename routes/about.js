/*
 * GET about page.
 */
var routesUtilities = require('../utilities/routes.js');

exports.index = function (req, res) {
  res.render('about', routesUtilities.getRenderObject(req));
};
