
/*
 * GET about page.
 */

exports.index = function(req, res){
  res.render('about', { username: req.session.username});
};