const debug = require('debug')('traveler:lib:review');
const mongoose = require('mongoose');

const User = mongoose.model('User');
const logger = require('./loggers').getLogger();

async function addReviewRequest(req, res, doc) {
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

async function removeReviewRequest(req, res, doc) {
  const { requestId } = req.params;
  const ids = requestId.split(',');
  try {
    logger.info(`review request of ${ids} removed from ${doc._id}`);
    await doc.removeReviewRequest(ids[0]);
    return res.status(200).json(ids);
  } catch (error) {
    logger.error(error);
    return res.status(500).send(error.message);
  }
}

async function addReviewResult(req, res, doc) {
  const { result = '2', comment, v } = req.body;
  try {
    await doc.addReviewResult(req.session.userid, result, comment, v);
    return res
      .status(201)
      .send(`review result from user ${req.session.userid} added.`);
  } catch (error) {
    logger.error(`failed to add review result, ${error}`);
    return res.status(500).send(error.message);
  }
}

module.exports = { addReviewRequest, removeReviewRequest, addReviewResult };
