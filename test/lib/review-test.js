const sinon = require('sinon');
const config = require('../../config/config');
const { User } = require('../../model/user');
const { Form } = require('../../model/form');
const ldapClient = require('../../lib/ldap-client');
const emailLib = require('../../lib/email');
const reviewLib = require('../../lib/review');

require('chai').should();

describe('review', function() {
  afterEach(function() {
    sinon.restore();
  });

  describe('model/review.js #addReviewNotification', function() {
    it('should append an entry per attempt and persist it', async function() {
      const doc = new Form({ title: 'Pump Assembly' });
      doc.__review = {
        policy: 'all',
        reviewRequests: [],
        reviewResults: [],
        reviewNotifications: [],
      };
      sinon.stub(doc, 'save').resolves(doc);

      await doc.addReviewNotification('a@example.org', true);
      await doc.addReviewNotification('b@example.org', false);

      doc.__review.reviewNotifications.length.should.equal(2);
      doc.__review.reviewNotifications[0].recipient.should.equal(
        'a@example.org'
      );
      doc.__review.reviewNotifications[0].success.should.be.true;
      doc.__review.reviewNotifications[0].type.should.equal('request');
      doc.__review.reviewNotifications[1].recipient.should.equal(
        'b@example.org'
      );
      doc.__review.reviewNotifications[1].success.should.be.false;
      doc.save.calledTwice.should.be.true;
    });
  });

  describe('lib/review.js #addReviewRequest', function() {
    let req;
    let res;
    let doc;
    let sendStub;

    beforeEach(function() {
      config.email = {
        notification_email_address: 'traveler-noreply@example.com',
        disclaimer:
          'This is an automated message from eTraveler. Please do not reply.',
      };
      config.auth = {
        service: 'http://localhost:3001/',
        proxied_service: 'https://intra-gw.example.org/3001/',
      };
      config.ad = {
        searchBase: 'dc=example,dc=org',
        searchFilter: '(&(objectClass=inetOrgPerson)(uid=_id))',
        objAttributes: ['uid', 'displayName', 'mail'],
      };

      req = {
        body: { uid: 'jdoe', name: 'Jane Doe' },
        session: { userid: 'owner1' },
        proxied: false,
      };
      res = {
        status: sinon.stub().returnsThis(),
        send: sinon.stub().returnsThis(),
        json: sinon.stub().returnsThis(),
      };
      doc = {
        _id: 'form123',
        title: 'Pump Assembly',
        owner: 'owner1',
        requestReview: sinon.stub().resolves(),
        addReviewNotification: sinon.stub().resolves(),
      };

      sendStub = sinon.stub(emailLib, 'sendNotification').resolves(true);
    });

    it('sends the review-request email and records success for an existing reviewer', async function() {
      const reviewerDoc = {
        _id: 'jdoe',
        name: 'Jane Doe',
        email: 'jdoe@example.org',
        roles: ['reviewer'],
      };
      sinon
        .stub(User, 'findById')
        .returns({ exec: sinon.stub().resolves(reviewerDoc) });

      await reviewLib.addReviewRequest(req, res, doc);

      doc.requestReview.calledOnce.should.be.true;
      sendStub.calledOnce.should.be.true;
      const call = sendStub.firstCall.args[0];
      call.recipients.should.equal('jdoe@example.org');
      call.from.should.equal('traveler-noreply@example.com');
      call.text.should.include(
        'This is an automated message from eTraveler. Please do not reply.'
      );
      doc.addReviewNotification.calledWith('jdoe@example.org', true).should.be
        .true;
      res.status.calledWith(201).should.be.true;
    });

    it('still responds success and records failure when the send fails', async function() {
      sendStub.resolves(false);
      const reviewerDoc = {
        _id: 'jdoe',
        name: 'Jane Doe',
        email: 'jdoe@example.org',
        roles: ['reviewer'],
      };
      sinon
        .stub(User, 'findById')
        .returns({ exec: sinon.stub().resolves(reviewerDoc) });

      await reviewLib.addReviewRequest(req, res, doc);

      res.status.calledWith(201).should.be.true;
      doc.addReviewNotification.calledWith('jdoe@example.org', false).should.be
        .true;
    });

    it("cc's the form owner when the owner has an email on file", async function() {
      const reviewerDoc = {
        _id: 'jdoe',
        name: 'Jane Doe',
        email: 'jdoe@example.org',
        roles: ['reviewer'],
      };
      const ownerDoc = {
        _id: 'owner1',
        name: 'Owner One',
        email: 'owner1@example.org',
      };
      const findByIdStub = sinon.stub(User, 'findById');
      findByIdStub
        .withArgs('jdoe')
        .returns({ exec: sinon.stub().resolves(reviewerDoc) });
      findByIdStub
        .withArgs('owner1')
        .returns({ exec: sinon.stub().resolves(ownerDoc) });

      await reviewLib.addReviewRequest(req, res, doc);

      sendStub.firstCall.args[0].cc.should.equal('owner1@example.org');
    });

    it('auto-creates a user from a unique directory match, but leaves the Reviewer-role check unaffected', async function() {
      sinon
        .stub(User, 'findById')
        .returns({ exec: sinon.stub().resolves(null) });
      sinon.stub(ldapClient, 'search').callsFake((base, opts, raw, cb) => {
        cb(null, [{ displayName: 'Jane Doe', mail: 'jdoe@example.org' }]);
      });
      const saveStub = sinon.stub(User.prototype, 'save').resolves();

      await reviewLib.addReviewRequest(req, res, doc);

      saveStub.calledOnce.should.be.true;
      const created = saveStub.thisValues[0];
      created._id.should.equal('jdoe');
      created.name.should.equal('Jane Doe');
      created.email.should.equal('jdoe@example.org');
      created.roles.should.deep.equal([]);
      // still blocked on the existing, unaffected Reviewer-role check
      res.status.calledWith(400).should.be.true;
      doc.requestReview.called.should.be.false;
      sendStub.called.should.be.false;
    });

    it('rejects without creating a user when the directory lookup finds nothing', async function() {
      sinon
        .stub(User, 'findById')
        .returns({ exec: sinon.stub().resolves(null) });
      sinon.stub(ldapClient, 'search').callsFake((base, opts, raw, cb) => {
        cb(null, []);
      });
      const saveStub = sinon.stub(User.prototype, 'save').resolves();

      await reviewLib.addReviewRequest(req, res, doc);

      saveStub.called.should.be.false;
      res.status.calledWith(400).should.be.true;
    });

    it('rejects without creating a user when the directory lookup is ambiguous', async function() {
      sinon
        .stub(User, 'findById')
        .returns({ exec: sinon.stub().resolves(null) });
      sinon.stub(ldapClient, 'search').callsFake((base, opts, raw, cb) => {
        cb(null, [{ displayName: 'A' }, { displayName: 'B' }]);
      });
      const saveStub = sinon.stub(User.prototype, 'save').resolves();

      await reviewLib.addReviewRequest(req, res, doc);

      saveStub.called.should.be.false;
      res.status.calledWith(400).should.be.true;
    });
  });
});
