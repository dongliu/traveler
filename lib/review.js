const mongoose = require('mongoose');

const { Reviewer } = require('./role');
const { releaseForm } = require('./form');
const { sendNotification } = require('./email');

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

    const reviewLink = `${req.protocol}://${req.get('host')}/forms/${doc._id}/`
    sendNotification({
      recipients: reviewer.email,
      subject: "New Review Request",
      text: `You have been asked to review the following template: ${doc.title}
Go to this link to complete the review: 
${reviewLink}`,
      html: `You have been asked to review the following template: ${doc.title}<br/>Go to this link to complete the review:<br/><a href="${reviewLink}">${reviewLink}</a>`
    })
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
    const reviewLink = `${req.protocol}://${req.get('host')}/forms/${doc._id}/`

    const newDoc = await doc.addReviewResult(req.session.userid, result, comment, v);
    const reviewer = await User.findOne({
      _id: req.session.userid,
    }).exec();

    const verb = (result == '1') ? "approved" : "rejected";
    if (newDoc.status === 0.5 && newDoc.allApproved) {
      sendNotification({
        recipients: reviewer.email,
        subject: "Review Complete",
        text: `${reviewer.name} has ${verb} the template: ${doc.title}.
This was the final reviewer and the template has been released. Go to this link to view the review results: 
${reviewLink}

Comments:
${comment}`,
        html: `${reviewer.name} has ${verb} the template: ${doc.title}<br/>This was the final reviewer and the template has been released. Go to this link to view the review results:<br/><a href="${reviewLink}">${reviewLink}</a><br/><br/>Comments:<br/>${comment}`
      });
      return await releaseForm(req, res)
    }

    sendNotification({
      recipients: reviewer.email,
      subject: "Review Added",
      text: `${reviewer.name} has ${verb} the template: ${doc.title}.
Go to this link to view the review results: ${reviewLink}

Comments:
${comment}`,
      html: `${reviewer.name} has ${verb} the template: ${doc.title}<br/>Go to this link to view the review results: <a href="${reviewLink}">${reviewLink}</a><br/><br/>Comments:<br/>${comment}`
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
