/**
 * Batched account id -> display name resolution, with graceful fallback.
 * See specs/006-user-full-name-display/research.md (Decision 1) and
 * data-model.md ("Resolved Display Name").
 */

/**
 * The distinct, non-blank ids in `ids`, as strings, in first-seen order.
 * @param  {Array} ids
 * @return {String[]}
 */
function distinctIds(ids) {
  const seen = {};
  const result = [];
  (ids || []).forEach(function add(id) {
    if (id === undefined || id === null || id === '') {
      return;
    }
    const key = String(id);
    if (!seen[key]) {
      seen[key] = true;
      result.push(key);
    }
  });
  return result;
}

/**
 * Resolve each of `ids` to the display name on its `User` document, falling
 * back to the id itself when there is no matching document or it has no
 * `name` on file (FR-003). Issues at most one query, for the distinct,
 * non-blank ids in `ids` — none at all when there are none.
 * @param  {Array} ids   account identifiers; duplicates and blanks are fine
 * @param  {Object} User a Mongoose-like model with a `find` method
 * @return {Promise<Object>} map of id -> display name
 */
async function resolveNames(ids, User) {
  const uniqueIds = distinctIds(ids);
  const names = {};
  uniqueIds.forEach(function seedFallback(id) {
    names[id] = id;
  });
  if (uniqueIds.length === 0) {
    return names;
  }
  const users = await User.find({ _id: { $in: uniqueIds } }, 'name').exec();
  (users || []).forEach(function applyName(user) {
    if (user && user.name) {
      names[user._id] = user.name;
    }
  });
  return names;
}

/**
 * A plain object for `doc`: `doc.toObject()` when available, otherwise `doc`
 * itself (already plain, e.g. from a `.lean()` query or `.aggregate()`).
 * A field attached directly to a live Mongoose document (e.g.
 * `doc.createdByName = ...`) is readable on that object (Jade templates can
 * use it as a render local), but is silently dropped by `JSON.stringify` /
 * `res.json(...)`, since Mongoose's own `toJSON` only serializes schema
 * paths. Call this first whenever the decorated object will be sent as a
 * JSON response, so the added `<field>Name` properties actually reach the
 * client; it is unnecessary (but harmless) before decorating a document
 * that is only ever read directly, such as a `res.render(...)` local.
 * @param  {Object} doc
 * @return {Object}
 */
function toPlain(doc) {
  if (doc && typeof doc.toObject === 'function') {
    return doc.toObject();
  }
  return doc;
}

/**
 * The ids referenced by `doc`'s own top-level `fields` (e.g.
 * `['createdBy', 'updatedBy', 'owner']`) — only the ones actually present.
 * @param  {Object} doc
 * @param  {String[]} fields
 * @return {Array}
 */
function collectIds(doc, fields) {
  const ids = [];
  (fields || []).forEach(function addField(field) {
    if (doc && doc[field]) {
      ids.push(doc[field]);
    }
  });
  return ids;
}

/**
 * Set `${field}Name` on `doc`, from `names`, for every field in `fields`
 * that `doc` has a value for. Mutates and returns `doc`.
 * @param  {Object} doc
 * @param  {String[]} fields
 * @param  {Object} names   as returned by resolveNames
 * @return {Object} doc
 */
function applyNames(doc, fields, names) {
  (fields || []).forEach(function applyField(field) {
    if (doc && doc[field]) {
      doc[`${field}Name`] = names[doc[field]];
    }
  });
  return doc;
}

/**
 * The reviewer ids referenced by a `sharedWith`-shaped list — the array of
 * `{_id, access}` items the `share.js` mixin attaches to Form, Traveler, and
 * Binder documents (see data-model.md). `sharedGroup` is not a person
 * reference and is never passed here.
 * @param  {Array} sharedWith
 * @return {Array}
 */
function collectSharedWithIds(sharedWith) {
  return (sharedWith || [])
    .filter(function hasId(share) {
      return share && share._id;
    })
    .map(function id(share) {
      return share._id;
    });
}

/**
 * Set `.name` on every item of a `sharedWith`-shaped list, from `names`.
 * Mutates and returns the list (or `[]` when `sharedWith` is falsy).
 * @param  {Array} sharedWith
 * @param  {Object} names
 * @return {Array}
 */
function applySharedWithNames(sharedWith, names) {
  const list = sharedWith || [];
  list.forEach(function applyShare(share) {
    if (share && share._id) {
      share.name = names[share._id];
    }
  });
  return list;
}

/**
 * The reviewer ids referenced by a review object (`{reviewRequests,
 * reviewResults}`, as attached by the `addReview` schema mixin — see
 * model/review.js and data-model.md). `review` may be `undefined` or `{}`
 * when the document has never been under review.
 * @param  {Object} review
 * @return {Array}
 */
function collectReviewIds(review) {
  const ids = [];
  ((review && review.reviewRequests) || []).forEach(function addRequest(
    request
  ) {
    if (request && request._id) {
      ids.push(request._id);
    }
    if (request && request.requestedBy) {
      ids.push(request.requestedBy);
    }
  });
  ((review && review.reviewResults) || []).forEach(function addResult(result) {
    if (result && result.reviewerId) {
      ids.push(result.reviewerId);
    }
  });
  return ids;
}

/**
 * Set `.name` (the reviewer) and `.requestedByName` (who asked them) on
 * every `reviewRequests` item, and `.reviewerName` on every `reviewResults`
 * item of a review object, from `names`. Mutates and returns `review` (or
 * `{}` when `review` is falsy).
 * @param  {Object} review
 * @param  {Object} names
 * @return {Object}
 */
function applyReviewNames(review, names) {
  const plain = review || {};
  (plain.reviewRequests || []).forEach(function applyRequest(request) {
    if (request && request._id) {
      request.name = names[request._id];
    }
    if (request && request.requestedBy) {
      request.requestedByName = names[request.requestedBy];
    }
  });
  (plain.reviewResults || []).forEach(function applyResult(result) {
    if (result && result.reviewerId) {
      result.reviewerName = names[result.reviewerId];
    }
  });
  return plain;
}

/**
 * Decorate a list of documents (plain, `.lean()`, or live Mongoose
 * documents) with `<field>Name` for each of `fields`, in one batched
 * lookup, and return plain objects so the added fields survive res.json().
 * This is the common case for a list-returning endpoint whose person
 * references are all top-level fields on each item (no `sharedWith` or
 * review subdocuments to handle) — see contracts/internal-json-endpoints.md.
 * @param  {Array} docs
 * @param  {String[]} fields
 * @param  {Object} User a Mongoose-like model with a `find` method
 * @return {Promise<Array>}
 */
async function withFieldNames(docs, fields, User) {
  const plainDocs = (docs || []).map(toPlain);
  const ids = [];
  plainDocs.forEach(function collect(doc) {
    collectIds(doc, fields).forEach(function push(id) {
      ids.push(id);
    });
  });
  const names = await resolveNames(ids, User);
  plainDocs.forEach(function apply(doc) {
    applyNames(doc, fields, names);
  });
  return plainDocs;
}

module.exports = {
  resolveNames,
  toPlain,
  collectIds,
  applyNames,
  collectSharedWithIds,
  applySharedWithNames,
  collectReviewIds,
  applyReviewNames,
  withFieldNames,
};
