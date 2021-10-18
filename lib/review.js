const mongoose = require('mongoose');

const User = mongoose.model('User');
const logger = require('./loggers').getLogger();

async function addReviewer(req, res, doc) {
  const { name } = req.body;
  try {
    const reviewer = await User.findOne({
      name,
    }).exec();
    if (!reviewer) {
      return res
        .status(400)
        .send(
          `please add ${name} to etraveler user list and assign manager role to the user.`
        );
    }
    if (!reviewer.roles.includes('manager')) {
      return res
        .status(400)
        .send(`User ${name} needs to have manager role in order to review.`);
    }
    await doc.requestReview(req.session.userid, reviewer);
    return res.status(201).send(`review request added for user ${name} .`);
  } catch (error) {
    logger.error(error);
    return res.status(500).send(error.message);
  }
}

module.exports = { addReviewer };
