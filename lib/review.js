const mongoose = require('mongoose');

const { Reviewer } = require('./role');
const config = require('../config/config');
const ldapClient = require('./ldap-client');
const emailLib = require('./email');

const User = mongoose.model('User');
const logger = require('./loggers').getLogger();

/**
 * look up a single directory identity by uid, for auto-provisioning a
 * reviewer account. Resolves null on any lookup error, or when the
 * directory has zero or more than one match for uid — the caller must
 * never create an account from an ambiguous or missing lookup.
 */
function findAdUser(uid) {
  const { ad } = config;
  return new Promise(resolve => {
    const opts = {
      filter: ad.searchFilter.replace('_id', uid),
      attributes: ad.objAttributes,
      scope: 'sub',
    };
    ldapClient.search(ad.searchBase, opts, false, (err, result) => {
      if (err || !result || result.length !== 1) {
        return resolve(null);
      }
      return resolve(result[0]);
    });
  });
}

/**
 * send the review-request notification (per specs/email.md) and record the
 * attempt on doc, regardless of outcome. Never throws — a notification
 * failure must not affect the already-completed reviewer assignment.
 */
async function sendReviewRequestNotification(req, doc, reviewer) {
  try {
    const owner = doc.owner ? await User.findById(doc.owner).exec() : null;
    const formUrl = `${
      req.proxied ? config.auth.proxied_service : config.auth.service
    }/forms/${doc._id}/`;
    const text = [
      `Hi ${reviewer.name},`,
      '',
      `You have been assigned to review the following eTraveler form, requested by ${
        owner ? owner.name : req.session.userid
      }.`,
      `Please review the form at ${formUrl} and complete the required action in eTraveler.`,
      '',
      config.email.disclaimer,
      '',
      'Thank you.',
    ].join('\n');
    const sent = await emailLib.sendNotification({
      subject: `Traveler form review request for ${doc._id}`,
      recipients: reviewer.email,
      cc: owner && owner.email,
      from: config.email.notification_email_address,
      text,
    });
    await doc.addReviewNotification(reviewer.email, sent);
  } catch (error) {
    logger.error(`review request notification error: ${error}`);
  }
}

async function addReviewRequest(req, res, doc) {
  const { uid, name } = req.body;
  try {
    // id in user model is all lower case
    let reviewer = await User.findById(uid.toLowerCase()).exec();
    if (!reviewer) {
      const adUser = await findAdUser(uid);
      if (!adUser) {
        return res
          .status(400)
          .send(
            `${uid} was not found in the directory, or is not unique, and cannot be added as a reviewer.`
          );
      }
      reviewer = new User({
        _id: uid.toLowerCase(),
        name: adUser.displayName,
        email: adUser.mail,
        roles: [],
      });
      await reviewer.save();
    }
    if (!reviewer.roles.includes(Reviewer)) {
      return res
        .status(400)
        .send(`User ${name} needs to have reviewer role in order to review.`);
    }
    await doc.requestReview(req.session.userid, reviewer);
    await sendReviewRequestNotification(req, doc, reviewer);
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
