const mongoose = require('mongoose');

// Guarantees a local User record exists for a person already resolved from
// the AD/directory typeahead (id, display name, email already known to the
// caller -- no second, server-side directory lookup here). Never overwrites
// an existing record; only creates one when none exists, and only when an
// email is available to create it with.
async function ensureUserExists({ id, name, email }) {
  const User = mongoose.model('User');
  const existing = await User.findById(id);
  if (existing) return existing;

  if (!email) {
    const err = new Error(`Cannot add ${id} - no email address is available for them`);
    err.status = 400;
    throw err;
  }

  const user = new User({ _id: id, name, email });
  await user.save();
  return user;
}

module.exports = { ensureUserExists };
