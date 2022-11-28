const debug = require('debug')('traveler:route:review');
const mongoose = require('mongoose');
const auth = require('../lib/auth');
const routesUtilities = require('../utilities/routes');

const { Reviewer } = require('../lib/role');

const User = mongoose.model('User');
const Form = mongoose.model('Form');

module.exports = function(app) {
  app.get('/reviews/', auth.ensureAuthenticated, function(req, res) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf(Reviewer) === -1
    ) {
      return res.status(403).send('only reviewer allowed');
    }
    return res.render('reviews', routesUtilities.getRenderObject(req));
  });

  app.get('/reviews/forms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    if (
      req.session.roles === undefined ||
      req.session.roles.indexOf(Reviewer) === -1
    ) {
      return res.status(403).send('only reviewer allowed');
    }
    try {
      const me = await User.findOne(
        {
          _id: req.session.userid,
        },
        'reviews'
      ).exec();
      if (!me) {
        return res.status(400).send('cannot identify the current user');
      }
      const forms = await Form.find(
        {
          _id: {
            $in: me.reviews,
          },
          archived: {
            $ne: true,
          },
        },
        'title formType status tags _v __review'
      ).exec();
      return res.status(200).json(forms);
    } catch (error) {
      debug(`error: ${error}`);
      return res.status(500).send(error.message);
    }
  });
};
