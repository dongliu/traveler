const debug = require('debug')('traveler:route:review');
const mongoose = require('mongoose');
const auth = require('../lib/auth');
const routesUtilities = require('../utilities/routes');

const { Review_forms } = require('../lib/permission');

const User = mongoose.model('User');
const Form = mongoose.model('Form');

module.exports = function(app) {
  app.get('/reviews/', auth.ensureAuthenticated, function(req, res) {
    if (!routesUtilities.hasPermission(req, Review_forms)) {
      return res.status(403).send('not authorized to view reviews');
    }
    return res.render('reviews', routesUtilities.getRenderObject(req));
  });

  app.get('/reviews/forms/json', auth.ensureAuthenticated, async function(
    req,
    res
  ) {
    if (!routesUtilities.hasPermission(req, Review_forms)) {
      return res.status(403).send('not authorized to view reviews');
    }
    try {
      // after upton change, review request is only tracked in form document
      // not in the user's review list anymore
      const forms = await Form.find(
        {
          '__review.reviewRequests._id': req.session.userid,
          archived: {
            $ne: true,
          },
        },
        'title formType status tags _v __review'
      ).sort([['requestedOn', -1]]).exec();
      return res.status(200).json(forms);
    } catch (error) {
      debug(`error: ${error}`);
      return res.status(500).send(error.message);
    }
  });

  app.get(
    '/reviews/forms/active/json',
    auth.ensureAuthenticated,
    async function(req, res) {
      if (!routesUtilities.hasPermission(req, Review_forms)) {
        return res.status(403).send('not authorized to view reviews');
      }
      try {
        const forms = await Form.find(
          {
            '__review.reviewRequests._id': req.session.userid,
            status: 0.5,
            archived: {
              $ne: true,
            },
          },
          'title formType status tags _v __review'
        )
          .sort([['requestedOn', -1]])
          .exec();
        return res.status(200).json(forms);
      } catch (error) {
        debug(`error: ${error}`);
        return res.status(500).send(error.message);
      }
    }
  );
};
