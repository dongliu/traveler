/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');

const User = mongoose.model('User');
const { Schema } = mongoose;

const debug = require('debug')('traveler:review');
const logger = require('../lib/loggers').getLogger();

const reviewRequest = new Schema({
  // use the reviewer _id as review request id, in order to use addToSet
  _id: {
    type: String,
    required: true,
  },
  requestedOn: Date,
  requestedBy: String,
});

// result: 1: approve 2: comment
const reviewResult = new Schema({
  reviewerId: {
    type: String,
    required: true,
  },
  result: {
    type: String,
    required: true,
  },
  v: Number,
  submittedOn: Date,
  comment: String,
});

const review = new Schema({
  policy: {
    type: String,
    required: true,
    default: 'all',
    enum: ['all', 'any', 'majority'],
  },
  reviewRequests: [reviewRequest],
  reviewResults: [reviewResult],
});

async function removeReviewRequest(doc, id) {
  try {
    doc.__review.reviewRequests.id(id).remove();
    await doc.save();
    debug(`${id} removed from ${doc._id}`);
    const pull = { reviews: doc._id };
    await User.findByIdAndUpdate(id, {
      $pull: pull,
    });
    debug(`${doc._id} removed from user ${id}`);
  } catch (error) {
    logger.error(`request review db error: ${error}`);
    throw error;
  }
}

async function closeReviewRequests(doc) {
  const requests = doc.__review.reviewRequests;
  const pull = { reviews: doc._id };
  let i;
  const actions = [];
  for (i = 0; i < requests.length; i += 1) {
    actions.push(
      User.findByIdAndUpdate(requests[i]._id, {
        $pull: pull,
      })
    );
  }
  try {
    await Promise.all(actions);
  } catch (error) {
    logger.error(`request review db error: ${error}`);
    throw error;
  }
}

const Review = mongoose.model('Review', review);

function addReview(schema) {
  schema.add({
    __review: review,
  });

  schema.methods.requestReview = async function(requesterId, reviewer) {
    const doc = this;
    try {
      if (!doc.__review) {
        doc.__review = {
          policy: 'all',
          reviewRequests: [],
          reviewResults: [],
        };
      }
      doc.__review.reviewRequests.addToSet({
        _id: reviewer._id,
        requestedOn: Date.now(),
        requestedBy: requesterId,
      });
      const newDoc = await doc.save();
      debug(`doc saved as ${newDoc}`);
      reviewer.reviews.addToSet(newDoc._id);
      const newReviewer = await reviewer.save();
      debug(`reviewer saved as ${newReviewer}`);
      return newDoc;
    } catch (error) {
      logger.error(`request review db error: ${error}`);
      throw error;
    }
  };

  schema.methods.removeReviewRequest = async function(id) {
    const doc = this;
    await removeReviewRequest(doc, id);
  };

  schema.methods.closeReviewRequests = async function() {
    const doc = this;
    await closeReviewRequests(doc);
  };

  schema.methods.addReviewResult = async function(
    reviewerId,
    result,
    comment,
    v
  ) {
    const doc = this;
    try {
      doc.__review.reviewResults.push({
        reviewerId,
        result,
        comment,
        submittedOn: Date.now(),
        v,
      });

      // if rework (result = 2), then
      // 0. set doc status to 0
      // 1. remove doc from reviewer's review list
      // 2. remove reviewer from reviewer list
      if (result === '2') {
        doc.status = 0;
        closeReviewRequests(doc);
        doc.__review.reviewRequests = [];
      }
      const newDoc = await doc.save();
      debug(`doc saved as ${newDoc}`);
      return newDoc;
    } catch (error) {
      logger.error(`update review db error: ${error}`);
      throw error;
    }
  };

  schema.methods.allApproved = function() {
    const doc = this;
    if (!doc.__review) {
      return false;
    }
    const { reviewRequests = [], reviewResults = [] } = doc.__review;
    if (reviewRequests.length === 0) {
      return false;
    }
    const approval = new Map();
    let i;
    debug(`has ${reviewResults.length} results`);
    debug(`has ${reviewRequests.length} requests`);
    // filter to the current version
    const docVersion = doc._v;
    const currentReviewResults = reviewResults.filter(r => r.v === docVersion);
    // the last is the latest
    for (i = currentReviewResults.length - 1; i >= 0; i -= 1) {
      debug(`${i} : ${currentReviewResults[i].result}`);
      if (!approval.has(currentReviewResults[i].reviewerId)) {
        if (reviewResults[i].result === '1') {
          approval.set(currentReviewResults[i].reviewerId, true);
        } else {
          approval.set(currentReviewResults[i].reviewerId, false);
        }
      }
      //   if (
      //     currentReviewResults[i].result !== '1' &&
      //     !approval.has(currentReviewResults[i].reviewerId)
      //   ) {
      //     approval[reviewResults[i].reviewerId] = false;
      //   }
      // if (
      //   reviewResults[i].result === '1' &&
      //   approval[reviewResults[i].reviewerId] !== undefined
      // ) {
      //   approval[reviewResults[i].reviewerId] = true;
      // }
    }
    for (i = 0; i < reviewRequests.length; i += 1) {
      if (!approval.get(reviewRequests[i]._id)) {
        return false;
      }
    }
    return true;
  };
}

module.exports = {
  review,
  reviewResult,
  addReview,
};
