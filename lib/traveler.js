const _ = require('lodash');
const mongoose = require('mongoose');

const routesUtilities = require('../utilities/routes');
const mqttUtilities = require('../utilities/mqtt');
const { stateTransition } = require('../model/traveler');
const { sendNotification } = require('../lib/email');
const { Approve_travelers } = require('../lib/permission');
const logger = require('../lib/loggers').getLogger();

const User = mongoose.model('User');
const Form = mongoose.model('Form');

async function updateStatus(req, res) {
  try {
    const doc = req[req.params.id];

    if ([1, 1.5, 2, 3, 4].indexOf(req.body.status) === -1) {
      return res.status(400).send('invalid status');
    }

    if (doc.status === req.body.status) {
      return res.status(204).send();
    }

    const target = _.find(stateTransition, function(t) {
      return t.from === doc.status;
    });

    if (!target || target.to.indexOf(req.body.status) === -1) {
      return res.status(400).send('invalid status change');
    }

    // authorize approve or reject traveler
    if (
      doc.status === 1.5 &&
      (req.body.status === 2 || req.body.status === 1) &&
      !routesUtilities.hasPermission(req, Approve_travelers)
    ) {
      return res
        .status(403)
        .send('You are not authorized to change the status. ');
    }

    // request more work or archive a completed traveler
    if (
      doc.status === 2 &&
      (req.body.status === 4 || req.body.status === 1) &&
      !routesUtilities.hasPermission(req, Approve_travelers)
    ) {
      return res
        .status(403)
        .send('You are not authorized to change the status. ');
    }

    const oldStatus = doc.status;
    doc.status = req.body.status;
    doc.updatedBy = req.session.userid;
    doc.updatedOn = Date.now();
    mqttUtilities.postTravelerStatusChangedMessage(doc);

    return doc.save(function(saveErr) {
      if (saveErr) {
        logger.error(saveErr);
        return res.status(500).send(saveErr.message);
      }
      if (doc.status === 1.5) {
        // notify form creator via submitForApproval
        try {
          submitForApproval(doc, req);
        } catch (e) {
          logger.error(e);
        }
      } else if (doc.status == 1 && oldStatus == 1.5) {
        const workerIds = doc.manPower.map(user => user._id);
        User.find({ _id: { $in: workerIds } }).then(users => {
          const travelerLink = `${req.protocol}://${req.get(
            'host'
          )}/travelers/${doc._id}/`;
          const emails = users.map(user => user.email);
          sendNotification({
            recipients: emails,
            subject: 'Traveler Rejected',
            html: `The traveler "${doc.title}" was sent back for more work. <br/>
              Please visit the traveler at this link: <br/>
              <a href="${travelerLink}">${travelerLink}</a>`,
          }).catch(err => logger.error(err));
        });
      }
      return res.status(200).send(`status updated to ${req.body.status}`);
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).send(error.message);
  }
}

/**
 * When a traveler is submitted for approval, find the form from the form table
 * with activeForm as id, populate the createdBy user with name and email,
 * and send notification email to the user.
 * @param {Object} traveler - the traveler object
 * @param {Object} req - the request object (for building the link)
 * @return {Promise<boolean>} true if email is sent, otherwise false
 */
async function submitForApproval(traveler, req) {
  try {
    // Find the form from the form table with activeForm as id
    const form = await Form.findById(traveler.activeForm).populate(
      'createdBy',
      'name email'
    );
    if (!form) {
      return false;
    }

    // Get the user who created the form
    const user = form.createdBy;
    if (!user || !user.email) {
      return false;
    }

    // add a review request
    await traveler.requestReview(req.session.userid, user);

    // Build the traveler link
    const travelerLink = `${req.protocol}://${req.get('host')}/travelers/${
      traveler._id
    }/`;

    // Send notification email
    return await sendNotification({
      recipients: user.email,
      subject: 'Traveler Submitted for Approval',
      text: `The traveler "${traveler.title}" has been submitted for approval.\nPlease review the traveler at this link: \n${travelerLink}`,
      html: `The traveler "${traveler.title}" has been submitted for approval. <br/>
      Please review the traveler at this link: <br/>
      <a href="${travelerLink}">${travelerLink}</a>`,
    });
  } catch (error) {
    logger.error(error);
    return false;
  }
}

module.exports = {
  updateStatus,
  submitForApproval,
};
