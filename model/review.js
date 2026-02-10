/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');

const User = mongoose.model('User');
const { Schema } = mongoose;

const debug = require('debug')('traveler:review');
const util = require('util');
const logger = require('../lib/loggers').getLogger();

const reviewRequest = new Schema({
  // use the reviewer _id as review request id, in order to use addToSet
  _id: {
    type: String,
    required: true,
  },
  requestedOn: Date,
  requestedBy: { type: String, ref: 'User' },
});

// result value
// 1: approve
// 2: reject, comment
const reviewResult = new Schema({
  reviewerId: {
    type: String,
    required: true,
  },
  result: {
    type: String,
    required: true,
  },
  // v is the version of the document being reviewed
  // when a document is showed with review results, only the results with v equal to document's current version should be shown
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

async function removeReviewRequest(doc, ids, save = true) {
  try {
    ids.forEach(id => {
      doc.__review.reviewRequests.id(id).remove();
    });
    let newDoc = doc;
    if (save) {
      newDoc = await doc.save();
    }
    debug(`${ids} removed from ${doc._id}`);
    // const pull = { reviews: doc._id };
    // await User.findByIdAndUpdate(id, {
    //   $pull: pull,
    // });
    // debug(`${doc._id} removed from user ${id}`);
    return newDoc;
  } catch (error) {
    logger.error(`request review db error: ${error}`);
    throw error;
  }
}

async function closeReviewRequests(doc) {
  // after upton change, this function does nothing
  // it used to remove the review requests from reviewers' review list
  return;
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
      // after upton change, do not add to reviewer's review list anymore
      return newDoc;
    } catch (error) {
      logger.error(`request review db error: ${error}`);
      throw error;
    }
  };

  schema.methods.removeReviewRequest = async function(ids) {
    const doc = this;
    return await removeReviewRequest(doc, ids);
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
      // 1. remove doc from reviewer's review list
      // 2. remove reviewer from reviewer list, after which a new review request is needed
      if (result === '2') {
        // doc.status = 0;
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

  schema.methods.isReviewer = function(userid) {
    const doc = this;
    return (
      doc.__review?.reviewRequests && doc.__review?.reviewRequests?.id(userid)
    );
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
    // for traveler use referenceReleasedFormVer as the temporary version. this might need to be changed later
    const docVersion = doc._v || 1;
    const currentReviewResults = reviewResults.filter(r => r.v === docVersion);
    // the last is the latest
    for (i = currentReviewResults.length - 1; i >= 0; i -= 1) {
      debug(
        `${i} : ${currentReviewResults[i].reviewerId} , ${currentReviewResults[i].result}`
      );
      // get the latest result for each reviewer
      if (!approval.has(currentReviewResults[i].reviewerId)) {
        approval.set(
          currentReviewResults[i].reviewerId,
          currentReviewResults[i].result
        );
      }
    }
    debug(`filtered list ${util.inspect(approval)}`);
    for (i = 0; i < reviewRequests.length; i += 1) {
      if (approval.get(reviewRequests[i]._id) !== '1') {
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
