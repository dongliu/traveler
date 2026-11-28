const sinon = require('sinon');

require('chai').should();

const { Traveler } = require('../../model/traveler');
const { ReleasedForm } = require('../../model/released-form');
const { backfillFromReleasedForm } = require('../../lib/traveler-metadata');

function stubbedTraveler(fields) {
  const doc = new Traveler(fields);
  sinon.stub(doc, 'save').resolves(doc);
  return doc;
}

describe('lib/traveler-metadata.js #backfillFromReleasedForm', function() {
  afterEach(function() {
    sinon.restore();
  });

  it('queries travelers by the released form id', async function() {
    const releasedForm = new ReleasedForm({});
    sinon.stub(Traveler, 'find').resolves([]);

    await backfillFromReleasedForm(releasedForm);

    Traveler.find.calledWith({
      referenceReleasedForm: releasedForm._id,
    }).should.be.true;
  });

  it('fills in all three fields when a traveler has them all blank and the released form has them all set', async function() {
    const releasedForm = new ReleasedForm({
      subsystem: 'Cryogenics',
      device: 'Magnet Assembly',
      activity: 'Inspection',
    });
    const traveler = stubbedTraveler({
      subsystem: '',
      device: '',
      activity: '',
    });
    sinon.stub(Traveler, 'find').resolves([traveler]);

    await backfillFromReleasedForm(releasedForm);

    traveler.subsystem.should.equal('Cryogenics');
    traveler.device.should.equal('Magnet Assembly');
    traveler.activity.should.equal('Inspection');
    traveler.save.calledOnce.should.be.true;
  });

  it('resolves cleanly with no travelers to update', async function() {
    const releasedForm = new ReleasedForm({
      subsystem: 'Cryogenics',
    });
    sinon.stub(Traveler, 'find').resolves([]);

    await backfillFromReleasedForm(releasedForm);
  });

  it('does not propagate a field that is itself blank on the released form', async function() {
    const releasedForm = new ReleasedForm({
      subsystem: '',
      device: '',
      activity: '',
    });
    const traveler = stubbedTraveler({
      subsystem: '',
      device: '',
      activity: '',
    });
    sinon.stub(Traveler, 'find').resolves([traveler]);

    await backfillFromReleasedForm(releasedForm);

    traveler.subsystem.should.equal('');
    traveler.device.should.equal('');
    traveler.activity.should.equal('');
    traveler.save.called.should.be.false;
  });

  it('never overwrites a field that already has a value, and skips save when nothing changed', async function() {
    const releasedForm = new ReleasedForm({
      subsystem: 'Vacuum',
      device: 'Turbo Pump',
      activity: 'Repair',
    });
    const traveler = stubbedTraveler({
      subsystem: 'Manual Override',
      device: 'Existing Device',
      activity: 'Existing Activity',
    });
    sinon.stub(Traveler, 'find').resolves([traveler]);

    await backfillFromReleasedForm(releasedForm);

    traveler.subsystem.should.equal('Manual Override');
    traveler.device.should.equal('Existing Device');
    traveler.activity.should.equal('Existing Activity');
    traveler.save.called.should.be.false;
  });

  it('updates only the blank fields on a traveler that has a mix of blank and non-blank fields', async function() {
    const releasedForm = new ReleasedForm({
      subsystem: 'Cryogenics',
      device: 'Magnet Assembly',
      activity: 'Inspection',
    });
    const traveler = stubbedTraveler({
      subsystem: '',
      device: 'Existing Device',
      activity: '',
    });
    sinon.stub(Traveler, 'find').resolves([traveler]);

    await backfillFromReleasedForm(releasedForm);

    traveler.subsystem.should.equal('Cryogenics');
    traveler.device.should.equal('Existing Device');
    traveler.activity.should.equal('Inspection');
    traveler.save.calledOnce.should.be.true;
  });
});
