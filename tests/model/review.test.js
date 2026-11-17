const mongoose = require('mongoose');
const sinon = require('sinon');
require('chai').should();

// Register a stub User model before loading review (the module calls mongoose.model('User') at load time)
if (!mongoose.modelNames().includes('User')) {
  mongoose.model('User', new mongoose.Schema({ _id: String }));
}

const { addReview } = require('../../model/review.js');

const TestSchema = new mongoose.Schema({ title: String });
addReview(TestSchema);
const TestModel = mongoose.model('ReviewTest', TestSchema);

function makeDoc(reviewResults = [], reviewRequests = []) {
  const doc = new TestModel({
    title: 'test',
    _v: 1,
    __review: { policy: 'all', reviewRequests, reviewResults },
  });
  sinon.stub(doc, 'save').callsFake(async function() {
    return this;
  });
  return doc;
}

describe('model/review — addReviewResult', () => {
  afterEach(() => sinon.restore());

  describe('approval (result = "1")', () => {
    it('appends the result to reviewResults', async () => {
      const doc = makeDoc();
      await doc.addReviewResult('userA', '1', 'looks good', 1);
      doc.__review.reviewResults.should.have.length(1);
      const r = doc.__review.reviewResults[0];
      r.reviewerId.should.equal('userA');
      r.result.should.equal('1');
      r.comment.should.equal('looks good');
      r.v.should.equal(1);
    });

    it('does not void any existing results', async () => {
      const doc = makeDoc([{ reviewerId: 'userB', result: '1', v: 1 }]);
      await doc.addReviewResult('userA', '1', '', 1);
      doc.__review.reviewResults[0].should.not.have.property('voided', true);
    });

    it('does not clear reviewRequests', async () => {
      const doc = makeDoc([], [{ _id: 'userA' }]);
      await doc.addReviewResult('userA', '1', '', 1);
      doc.__review.reviewRequests.should.have.length(1);
    });
  });

  describe('rejection (result = "2")', () => {
    it('appends the rejection to reviewResults', async () => {
      const doc = makeDoc();
      await doc.addReviewResult('userA', '2', 'needs work', 1);
      const last = doc.__review.reviewResults[doc.__review.reviewResults.length - 1];
      last.reviewerId.should.equal('userA');
      last.result.should.equal('2');
    });

    it('voids prior approvals with the same version', async () => {
      const doc = makeDoc([{ reviewerId: 'userB', result: '1', v: 1 }]);
      await doc.addReviewResult('userA', '2', '', 1);
      const prior = doc.__review.reviewResults[0];
      prior.voided.should.equal(true);
      prior.voidedOn.should.be.instanceOf(Date);
    });

    it('voids prior approvals when v is passed as a string (as sent by the client)', async () => {
      const doc = makeDoc([{ reviewerId: 'userB', result: '1', v: 1 }]);
      await doc.addReviewResult('userA', '2', '', '1');
      doc.__review.reviewResults[0].voided.should.equal(true);
    });

    it('does not void approvals for a different version', async () => {
      const doc = makeDoc([{ reviewerId: 'userB', result: '1', v: 2 }]);
      await doc.addReviewResult('userA', '2', '', 1);
      const prior = doc.__review.reviewResults[0];
      prior.should.not.have.property('voided', true);
    });

    it('does not re-void an already voided result', async () => {
      const originalDate = new Date('2024-01-01');
      const doc = makeDoc([{ reviewerId: 'userB', result: '1', v: 1, voided: true, voidedOn: originalDate }]);
      await doc.addReviewResult('userA', '2', '', 1);
      doc.__review.reviewResults[0].voidedOn.should.deep.equal(originalDate);
    });

    it('voids prior rejections with the same version', async () => {
      const doc = makeDoc([{ reviewerId: 'userB', result: '2', v: 1 }]);
      await doc.addReviewResult('userA', '2', '', 1);
      const prior = doc.__review.reviewResults[0];
      prior.voided.should.equal(true);
      prior.voidedOn.should.be.instanceOf(Date);
    });

    it('does not void the new rejection itself', async () => {
      const doc = makeDoc();
      await doc.addReviewResult('userA', '2', '', 1);
      const newest = doc.__review.reviewResults[doc.__review.reviewResults.length - 1];
      newest.result.should.equal('2');
      newest.should.not.have.property('voided', true);
    });

    it('clears reviewRequests', async () => {
      const doc = makeDoc([], [{ _id: 'userA' }, { _id: 'userB' }]);
      await doc.addReviewResult('userA', '2', '', 1);
      doc.__review.reviewRequests.should.have.length(0);
    });
  });
});
