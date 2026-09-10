const cheerio = require('cheerio');

/**
 * Compute the human-readable `ver` string for a released form produced by
 * composing a base released form with zero-to-many ACL released forms, e.g.
 * "base: 3, acl: 1, 2". The ACL versions are listed in the same order as
 * `aclVers` is given, which callers should pass in composition placement
 * order (the order the ACL sections are stacked in the traveler) rather
 * than sorted, so the display matches what a user actually composed.
 *
 * This is for DISPLAY only. Because two different ACL forms can validly
 * share the same version number, this string alone cannot reliably
 * distinguish which specific ACL forms are included — duplicate detection
 * must use `computeCompositionKey` instead, not this.
 * @param  {String|Number} baseVer the base ReleasedForm's own `ver`
 * @param  {[String|Number]} aclVers the selected ACL ReleasedForms' own
 *   `ver` values, in composition placement order
 * @return {String} the human-readable ver string
 */
function computeVer(baseVer, aclVers) {
  if (!aclVers || aclVers.length === 0) {
    return `base: ${baseVer}`;
  }
  return `base: ${baseVer}, acl: ${aclVers.join(', ')}`;
}

/**
 * Compute the deterministic composition key used to detect duplicate
 * compositions of a base released form with zero-to-many ACL released
 * forms. Built from the source released-form ids themselves (not their
 * version numbers), so it stays order-independent and never collides two
 * different ACL combinations that happen to share version numbers — the
 * exact ambiguity `computeVer`'s human-readable string cannot avoid.
 * @param  {String} baseId  the base ReleasedForm's id
 * @param  {[String]} aclIds the selected ACL ReleasedForm ids, any order
 * @return {String} the composition key
 */
function computeCompositionKey(baseId, aclIds) {
  if (!aclIds || aclIds.length === 0) {
    return `${baseId}`;
  }
  const sorted = aclIds
    .map(String)
    .slice()
    .sort();
  return `${baseId}:${sorted.join(',')}`;
}

/**
 * Collect the set of input/textarea names present in an html fragment.
 * @param  {String} html
 * @return {Set<String>}
 */
function extractInputNames(html) {
  const $ = cheerio.load(html || '');
  const names = new Set();
  $('input, textarea').each(function extract() {
    const name = $(this).attr('name');
    if (name) {
      names.add(name.trim());
    }
  });
  return names;
}

/**
 * Find input names that appear in more than one of the given form entries.
 * Used to reject composing forms whose fields would collide once merged
 * into a single traveler namespace.
 * @param  {[{label: String, html: String}]} entries
 * @return {[{name: String, forms: [String]}]} empty when there is no collision
 */
function findInputNameCollisions(entries) {
  const owners = new Map();
  entries.forEach(function trackEntry(entry) {
    extractInputNames(entry.html).forEach(function trackName(name) {
      if (!owners.has(name)) {
        owners.set(name, new Set());
      }
      owners.get(name).add(entry.label);
    });
  });

  const collisions = [];
  owners.forEach(function collectCollisions(labels, name) {
    if (labels.size > 1) {
      collisions.push({ name, forms: Array.from(labels) });
    }
  });
  return collisions;
}

module.exports = {
  computeVer,
  computeCompositionKey,
  findInputNameCollisions,
};
