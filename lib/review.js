const mongoose = require('mongoose');

const { Reviewer } = require('./role');

const User = mongoose.model('User');
const logger = require('./loggers').getLogger();

async function addReviewRequest(req, res, doc) {
  const { uid, name } = req.body;
  try {
    // id in user model is all lower case
    const reviewer = await User.findById(uid.toLowerCase()).exec();
    if (!reviewer) {
      return res
        .status(400)
        .send(
          `please add user id ${uid} to etraveler user list and assign reviewer role to the user.`
        );
    }
    if (!reviewer.roles.includes(Reviewer)) {
      return res
        .status(400)
        .send(`User ${name} needs to have reviewer role in order to review.`);
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
