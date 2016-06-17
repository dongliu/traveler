/*
 * GET documentation pages
 */


module.exports = function (app) {
  app.get('/docs/', function (req, res) {
    res.render('doc-in-one', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/docs/form-manager', function (req, res) {
    res.render('doc-form-manager', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });
};
