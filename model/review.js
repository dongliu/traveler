/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');

const User = mongoose.model('User');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

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

const reviewResult = new Schema({
  // use the reviewer _id as review result id, in order to use addToSet
  _id: {
    type: String,
    required: true,
  },
  result: {
    type: Boolean,
    required: true,
  },
  requestedOn: Date,
  requestedBy: String,
  updatedOn: {
    type: Date,
    required: true,
  },
  comment: String,
});

const review = new Schema({
  policy: {
    type: String,
    required: true,
    default: 'all',
    enum: ['all', 'any', 'majority'],
  },
  itemType: {
    type: String,
    required: true,
    enum: ['Form', 'Traveler'],
  },
  itemId: {
    type: ObjectId,
    refPath: 'itemType',
    required: true,
  },
  reviewRequests: [reviewRequest],
  reviewResults: [reviewResult],
});

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
          itemType: doc.constructor.modelName,
          itemId: doc._id,
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
  };

  schema.methods.updateReview = async function(result) {
    const doc = this;
    try {
      doc.__review.reviewResult.addToSet(result);
      const newDoc = await doc.save();
      debug(`doc saved as ${newDoc}`);
      return newDoc;
    } catch (error) {
      logger.error(`update review db error: ${error}`);
      throw error;
    }
  };
}

module.exports = {
  review,
  reviewResult,
  addReview,
};
