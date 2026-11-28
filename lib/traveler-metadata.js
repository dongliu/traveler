const mongoose = require('mongoose');

const Traveler = mongoose.model('Traveler');

const CLASSIFICATION_FIELDS = ['subsystem', 'device', 'activity'];

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Fill in any blank subsystem/device/activity on travelers created from
 * releasedForm (matched by referenceReleasedForm) with releasedForm's
 * current values for those fields. A traveler field is only ever moved
 * from blank to non-blank here; a field that already has a value, and
 * travelers tied to any other released form, are never touched. See
 * specs/008-backfill-traveler-metadata/.
 */
async function backfillFromReleasedForm(releasedForm) {
  const travelers = await Traveler.find({
    referenceReleasedForm: releasedForm._id,
  });

  await Promise.all(
    travelers.map(traveler => {
      let changed = false;
      CLASSIFICATION_FIELDS.forEach(field => {
        if (isBlank(traveler[field]) && !isBlank(releasedForm[field])) {
          traveler[field] = releasedForm[field];
          changed = true;
        }
      });
      return changed ? traveler.save() : null;
    })
  );
}

module.exports = {
  backfillFromReleasedForm,
};
