/*
 * GET about page.
 */

exports.index = function (req, res) {
  res.render('about', {
    prefix: req.proxied ? req.proxied_prefix : ''
  });
};
