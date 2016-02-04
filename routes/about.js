/*
 * GET about page.
 */


module.exports = function (app) {
  app.get('/about/', function (req, res) {
    res.render('about', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });

  app.get('/about/form-manager', function (req, res) {
    res.render('about-form-manager', {
      prefix: req.proxied ? req.proxied_prefix : ''
    });
  });
};
