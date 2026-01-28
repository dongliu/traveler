const mongoose = require('mongoose');

const config = require('../config/config.js');

const { releaseForm } = require('./form');
const { sendNotification } = require('./email');
const { getPermissions, Review_forms } = require('./permission');

const User = mongoose.model('User');
const logger = require('./loggers').getLogger();

async function addReviewRequest(req, res, doc) {
  const { uid, name } = req.body;
  try {
    // id in user model is all lower case
    const reviewer = await User.findById(uid.toLowerCase()).exec();
    // TODO: consider if we need a user record when requesting a review
    /**
     * Ideally, a user can first get a notification email to know that
     * s/he has been requested to review a form, and then the user can
     * log in to the system to see the review request.
     */
    if (!reviewer) {
      return res
        .status(400)
        .send(
          `please add user id ${uid} to the traveler user list. A user can be added by an admin. A user is added when s/he logs in for the first time.`
        );
    }

    const roles = [...reviewer.roles, ...config.auth.default_roles];
    logger.debug(`roles for user ${name}: ${roles}`);
    const permissions = getPermissions(roles);
    if (!permissions.includes(Review_forms)) {
      return res
        .status(400)
        .send(`User ${name} needs to have permission to review.`);
    }
    await doc.requestReview(req.session.userid, reviewer);

    const reviewLink = `${req.protocol}://${req.get('host')}/forms/${doc._id}/`;
    sendNotification({
      recipients: reviewer.email,
      subject: 'New Review Request',
      text: `You have been asked to review the following template: ${doc.title}
Go to this link to complete the review:
${reviewLink}`,
      html: `You have been asked to review the following template: ${doc.title}<br/>Go to this link to complete the review:<br/><a href="${reviewLink}">${reviewLink}</a>`,
    });
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
    const reviewLink = `${req.protocol}://${req.get('host')}/forms/${doc._id}/`;

    const newDoc = await doc.addReviewResult(
      req.session.userid,
      result,
      comment,
      v
    );
    const reviewer = await User.findOne({
      _id: req.session.userid,
    }).exec();
    const owner = await User.findOne({
      _id: newDoc.createdBy,
    }).exec();

    const verb = result == '1' ? 'approved' : 'rejected';
    if (newDoc.status === 0.5 && newDoc.allApproved()) {
      sendNotification({
        recipients: owner.email,
        subject: 'Review Complete',
        text: `${reviewer.name} has ${verb} the template: ${doc.title}.
This was the final reviewer and the template has been released. Go to this link to view the review results:
${reviewLink}

Comments:
${comment}`,
        html: `${reviewer.name} has ${verb} the template: ${doc.title}<br/>This was the final reviewer and the template has been released. Go to this link to view the review results:<br/><a href="${reviewLink}">${reviewLink}</a><br/><br/>Comments:<br/>${comment}`,
      });
      return await releaseForm(req, res);
    }

    sendNotification({
      recipients: owner.email,
      subject: 'Review Added',
      text: `${reviewer.name} has ${verb} the template: ${doc.title}.
Go to this link to view the review results: ${reviewLink}

Comments:
${comment}`,
      html: `${reviewer.name} has ${verb} the template: ${doc.title}<br/>Go to this link to view the review results: <a href="${reviewLink}">${reviewLink}</a><br/><br/>Comments:<br/>${comment}`,
    });

    return res
      .status(201)
      .send(`review result from user ${req.session.userid} added.`);
  } catch (error) {
    logger.error(`failed to add review result, ${error}`);
    return res.status(500).send(error.message);
  }
}

module.exports = { addReviewRequest, removeReviewRequest, addReviewResult };
