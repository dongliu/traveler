const mongoose = require('mongoose');

const config = require('../config/config.js');

const { releaseForm } = require('./form');
const { sendNotification } = require('./email');
const { getPermissions, Review_forms } = require('./permission');

const User = mongoose.model('User');
const logger = require('./loggers').getLogger();

function messageElement(doc, req) {
  let reviewLink;
  let docType;
  const type = doc.constructor.modelName;
  if (type === 'Form') {
    reviewLink = `${req.protocol}://${req.get('host')}/forms/${doc._id}/`;
    docType = 'template';
  } else if (type === 'Traveler') {
    reviewLink = `${req.protocol}://${req.get('host')}/travelers/${doc._id}/`;
    docType = 'traveler';
  } else {
    throw new Error(`Unsupported document type: ${doc.constructor.modelName}`);
  }
  return {
    reviewLink,
    docType,
    type,
  };
}

function allApproveNotification(owner, reviewer, verb, comment, doc, req) {
  const { reviewLink, docType, type } = messageElement(doc, req);
  if (type === 'Form' && doc.status !== 0.5) {
    logger.warn(
      `Form ${doc._id} has status ${doc.status}, not 0.5, skip sending all approve notification`
    );
    return;
  }
  if (type === 'Traveler' && doc.status !== 1.5) {
    logger.warn(
      `Traveler ${doc._id} has status ${doc.status}, not 1.5, skip sending all approve notification`
    );
    return;
  }
  const message = {
    recipients: owner.email,
    subject: 'Review Complete',
    text: `${reviewer.name} has ${verb} the ${docType}: ${doc.title}.\nThis was the final reviewer and the ${docType} has been fully approved. Go to this link to view the review results:${reviewLink}\nComments:\n${comment}`,
    html: `${reviewer.name} has ${verb} the ${docType}: ${doc.title}<br/>This was the final reviewer and the ${docType} has been fully approved. Go to this link to view the review results:<br/><a href="${reviewLink}">${reviewLink}</a><br/><br/>Comments:<br/>${comment}`,
  };
  sendNotification(message);
}

/**
 * when all reviewers approve, do the following flow
 * 1. send notification to owner
 * 2. update the document and/or create new document
 * @param {*} owner
 * @param {*} reviewer
 * @param {*} verb
 * @param {*} comment
 * @param {*} doc
 */
async function allApproveFlow(owner, reviewer, verb, comment, doc, req, res) {
  allApproveNotification(owner, reviewer, verb, comment, doc, req);
  if (doc.constructor.modelName === 'Form') {
    return releaseForm(req, res);
  }
  if (doc.constructor.modelName === 'Traveler') {
    // for traveler, when all approved, set status to 2
    doc.status = 2;
    doc.updatedOn = Date.now();
    doc.updatedBy = reviewer._id;
    await doc.save();
    return res.status(200).send('The traveler was approved.');
  }
}

/**
 * when the review is rejected, notification according to doc type
 *
 * @param {*} reviewer
 * @param {*} verb
 * @param {*} comment
 * @param {*} doc
 * @param {*} req
 * @param {*} res
 * @returns
 */
async function rejectionFlow(owner, reviewer, verb, comment, doc, req, res) {
  const { reviewLink, docType, type } = messageElement(doc, req);
  if (type === 'Form') {
    if (doc.status !== 0.5) {
      logger.warn(
        `Form ${doc._id} has status ${doc.status}, not 0.5, skip sending all approve notification`
      );
      return;
    } else {
      // set form status back to draft
      doc.status = 0;
      doc.updatedOn = Date.now();
      doc.updatedBy = reviewer._id;
      await doc.save();
    }
  }
  if (type === 'Traveler') {
    if (doc.status !== 1.5) {
      logger.warn(
        `Traveler ${doc._id} has status ${doc.status}, not 1.5, skip sending all approve notification`
      );
      return;
    } else {
      // set traveler status back to 1 (in progress)
      doc.status = 1;
      doc.updatedOn = Date.now();
      doc.updatedBy = reviewer._id;
      await doc.save();
    }
  }
  let recipients = [owner.email];
  if (type === 'Traveler') {
    recipients = [owner.email];
    // add all workers contributing to the traveler
    const workerIds = doc.manPower.map(user => user._id);
    const workers = await User.find({ _id: { $in: workerIds } }).exec();
    workers.forEach(user => {
      if (!recipients.includes(user.email)) {
        recipients.push(user.email);
      }
    });
  }
  const message = {
    recipients: recipients,
    subject: 'Review rejected',
    text: `${reviewer.name} has ${verb} the ${docType}: ${doc.title}.\nGo to this link to view the review results: ${reviewLink}\nComments:\n${comment}`,
    html: `${reviewer.name} has ${verb} the ${docType}: ${doc.title}<br/>Go to this link to view the review results: <a href="${reviewLink}">${reviewLink}</a><br/><br/>Comments:<br/>${comment}`,
  };
  sendNotification(message);
  return res.status(200).send('The review was recorded.');
}

function notification(owner, reviewer, verb, comment, doc, req) {
  const { reviewLink, docType, type } = messageElement(doc, req);
  const message = {
    recipients: owner.email,
    subject: 'Review Added',
    text: `${reviewer.name} has ${verb} the ${docType}: ${doc.title}.\nGo to this link to view the review results: ${reviewLink}\nComments:\n${comment}`,
    html: `${reviewer.name} has ${verb} the ${docType}: ${doc.title}<br/>Go to this link to view the review results: <a href="${reviewLink}">${reviewLink}</a><br/><br/>Comments:<br/>${comment}`,
  };
  sendNotification(message);
}

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
    if (newDoc.allApproved()) {
      return allApproveFlow(owner, reviewer, verb, comment, newDoc, req, res);
    }
    if (result == '2') {
      return rejectionFlow(owner, reviewer, verb, comment, newDoc, req, res);
    }
    notification(owner, reviewer, verb, comment, newDoc, req);
    return res.status(201).send(`review result from ${reviewer.name} added.`);
  } catch (error) {
    logger.error(`failed to add review result, ${error}`);
    return res.status(500).send(error.message);
  }
}

module.exports = { addReviewRequest, removeReviewRequest, addReviewResult };
