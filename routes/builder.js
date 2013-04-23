/*The index page of form builder*/
exports.index = function(req, res){
  res.render('builder', { username: req.session.username});
};

