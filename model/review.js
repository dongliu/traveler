/* eslint-disable no-param-reassign */
const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const debug = require('debug')('traveler:review');
const logger = require('../lib/loggers').getLogger();

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
    enum: ['form', 'traveler'],
  },
  itemId: {
    type: ObjectId,
    refPath: 'itemType',
    required: true,
  },
  requestedOn: Date,
  requestedBy: String,
  reviewers: [String],
  reviewResults: [reviewResult],
});

const Review = mongoose.model('Review', review);

function addReview(schema) {
  schema.add({
    __review: {
      type: ObjectId,
      ref: Review.modelName,
    },
  });

  schema.methods.requestReview = async function(reviewer) {
    const doc = this;
    try {
      doc.__review.reviewer.addToSet(reviewer._id);
      const newDoc = await doc.save();
      debug(`doc saved as ${newDoc}`);
      reviewer.reviewers.addToSet(newDoc._id);
      const newReviewer = await reviewer.save();
      debug(`reviewer saved as ${newReviewer}`);
      return newDoc;
    } catch (error) {
      logger.error(`request review db error: ${error}`);
      throw error;
    }
  };

  schema.methods.updateReview = async function(reviewResult) {
    const doc = this;
    try {
      doc.__review.reviewResult.addToSet(reviewResult);
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
