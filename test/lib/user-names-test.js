var userNames = require('../../lib/user-names');
var chai = require('chai');
var expect = chai.expect;

/**
 * A fake User model: only find(query, projection).exec() is provided, so a
 * test also proves resolveNames never uses any other model method.
 */
function fakeUserModel(users) {
  var model = { calls: [] };
  model.find = function find(query, projection) {
    model.calls.push({ query: query, projection: projection });
    return {
      exec: function exec() {
        var ids = (query && query._id && query._id.$in) || [];
        var matches = users.filter(function match(user) {
          return ids.indexOf(user._id) !== -1;
        });
        return Promise.resolve(matches);
      },
    };
  };
  return model;
}

describe('user-names', function() {
  describe('#resolveNames', function() {
    it('resolves a known id to its name', async function() {
      var model = fakeUserModel([{ _id: 'liud', name: 'Dong Liu' }]);
      var names = await userNames.resolveNames(['liud'], model);
      expect(names).to.deep.equal({ liud: 'Dong Liu' });
    });

    it('falls back to the id when the user has no name on file', async function() {
      var model = fakeUserModel([{ _id: 'liud', name: '' }]);
      var names = await userNames.resolveNames(['liud'], model);
      expect(names.liud).to.equal('liud');
    });

    it('falls back to the id when there is no matching user document', async function() {
      var model = fakeUserModel([]);
      var names = await userNames.resolveNames(['ghost'], model);
      expect(names.ghost).to.equal('ghost');
    });

    it('queries once for duplicate ids in the input', async function() {
      var model = fakeUserModel([{ _id: 'liud', name: 'Dong Liu' }]);
      var names = await userNames.resolveNames(['liud', 'liud', 'liud'], model);
      expect(model.calls).to.have.lengthOf(1);
      expect(model.calls[0].query._id.$in).to.deep.equal(['liud']);
      expect(names).to.deep.equal({ liud: 'Dong Liu' });
    });

    it('resolves several distinct ids in one query', async function() {
      var model = fakeUserModel([
        { _id: 'liud', name: 'Dong Liu' },
        { _id: 'smith', name: 'John Smith' },
      ]);
      var names = await userNames.resolveNames(['liud', 'smith'], model);
      expect(model.calls).to.have.lengthOf(1);
      expect(names).to.deep.equal({ liud: 'Dong Liu', smith: 'John Smith' });
    });

    it('issues no query and returns an empty map for an empty input', async function() {
      var model = fakeUserModel([{ _id: 'liud', name: 'Dong Liu' }]);
      var names = await userNames.resolveNames([], model);
      expect(model.calls).to.have.lengthOf(0);
      expect(names).to.deep.equal({});
    });

    it('ignores blank and null/undefined entries in the input', async function() {
      var model = fakeUserModel([{ _id: 'liud', name: 'Dong Liu' }]);
      var names = await userNames.resolveNames(
        ['liud', '', null, undefined],
        model
      );
      expect(model.calls).to.have.lengthOf(1);
      expect(model.calls[0].query._id.$in).to.deep.equal(['liud']);
      expect(names).to.deep.equal({ liud: 'Dong Liu' });
    });
  });

  describe('#toPlain', function() {
    it('calls toObject() when the document has one', function() {
      var doc = {
        createdBy: 'liud',
        toObject: function toObject() {
          return { createdBy: 'liud' };
        },
      };
      var plain = userNames.toPlain(doc);
      expect(plain).to.deep.equal({ createdBy: 'liud' });
      expect(plain).to.not.equal(doc);
    });

    it('returns the object unchanged when it has no toObject()', function() {
      var doc = { createdBy: 'liud' };
      expect(userNames.toPlain(doc)).to.equal(doc);
    });
  });

  describe('#collectIds / #applyNames', function() {
    it('collects only the fields that are present', function() {
      var doc = { createdBy: 'liud', owner: '' };
      expect(
        userNames.collectIds(doc, ['createdBy', 'updatedBy', 'owner'])
      ).to.deep.equal(['liud']);
    });

    it('sets <field>Name only for fields the doc has', function() {
      var doc = { createdBy: 'liud' };
      userNames.applyNames(doc, ['createdBy', 'updatedBy'], {
        liud: 'Dong Liu',
      });
      expect(doc.createdByName).to.equal('Dong Liu');
      expect(doc).to.not.have.property('updatedByName');
    });
  });

  describe('#collectSharedWithIds / #applySharedWithNames', function() {
    it('collects ids from a sharedWith-shaped list, skipping entries with no _id', function() {
      var sharedWith = [{ _id: 'smith', access: 0 }, { access: 1 }];
      expect(userNames.collectSharedWithIds(sharedWith)).to.deep.equal([
        'smith',
      ]);
      expect(userNames.collectSharedWithIds(undefined)).to.deep.equal([]);
    });

    it('sets .name on each entry that has an _id', function() {
      var sharedWith = [{ _id: 'smith', access: 0 }, { access: 1 }];
      userNames.applySharedWithNames(sharedWith, { smith: 'John Smith' });
      expect(sharedWith[0].name).to.equal('John Smith');
      expect(sharedWith[1]).to.not.have.property('name');
    });
  });

  describe('#collectReviewIds / #applyReviewNames', function() {
    it('collects reviewer and requester ids from reviewRequests, and reviewer ids from reviewResults', function() {
      var review = {
        reviewRequests: [
          { _id: 'smith', requestedBy: 'liud', requestedOn: new Date() },
        ],
        reviewResults: [{ reviewerId: 'liud', result: 'approve' }],
      };
      expect(userNames.collectReviewIds(review)).to.deep.equal([
        'smith',
        'liud',
        'liud',
      ]);
      expect(userNames.collectReviewIds(undefined)).to.deep.equal([]);
    });

    it('sets .name and .requestedByName on reviewRequests, and .reviewerName on reviewResults', function() {
      var review = {
        reviewRequests: [{ _id: 'smith', requestedBy: 'liud' }],
        reviewResults: [{ reviewerId: 'liud' }],
      };
      userNames.applyReviewNames(review, {
        smith: 'John Smith',
        liud: 'Dong Liu',
      });
      expect(review.reviewRequests[0].name).to.equal('John Smith');
      expect(review.reviewRequests[0].requestedByName).to.equal('Dong Liu');
      expect(review.reviewResults[0].reviewerName).to.equal('Dong Liu');
    });

    it('returns {} for a falsy review', function() {
      expect(userNames.applyReviewNames(undefined, {})).to.deep.equal({});
    });
  });

  describe('#withFieldNames', function() {
    it('decorates every doc with <field>Name, in one batched query', async function() {
      var model = fakeUserModel([
        { _id: 'liud', name: 'Dong Liu' },
        { _id: 'smith', name: 'John Smith' },
      ]);
      var docs = [
        { _id: '1', releasedBy: 'liud' },
        { _id: '2', releasedBy: 'smith', archivedBy: 'liud' },
      ];
      var decorated = await userNames.withFieldNames(
        docs,
        ['releasedBy', 'archivedBy'],
        model
      );
      expect(model.calls).to.have.lengthOf(1);
      expect(decorated[0].releasedByName).to.equal('Dong Liu');
      expect(decorated[1].releasedByName).to.equal('John Smith');
      expect(decorated[1].archivedByName).to.equal('Dong Liu');
    });

    it('calls toObject() on each doc so added fields survive res.json()', async function() {
      var model = fakeUserModel([{ _id: 'liud', name: 'Dong Liu' }]);
      var doc = {
        releasedBy: 'liud',
        toObject: function toObject() {
          return { releasedBy: 'liud' };
        },
      };
      var decorated = await userNames.withFieldNames(
        [doc],
        ['releasedBy'],
        model
      );
      expect(decorated[0]).to.not.equal(doc);
      expect(decorated[0].releasedByName).to.equal('Dong Liu');
    });
  });
});
