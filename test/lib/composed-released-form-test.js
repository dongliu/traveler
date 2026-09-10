var composed = require('../../lib/composed-released-form');
require('chai').should();

describe('composed-released-form', function() {
  describe('#computeVer', function() {
    it('should show just the base version when there are no ACL versions', function() {
      composed.computeVer(3, []).should.equal('base: 3');
      composed.computeVer(3, undefined).should.equal('base: 3');
    });

    it('should list a single ACL version after the base version', function() {
      composed.computeVer(3, [1]).should.equal('base: 3, acl: 1');
    });

    it('should list multiple ACL versions in the given (placement) order, not sorted', function() {
      composed.computeVer(3, [2, 1, 5]).should.equal('base: 3, acl: 2, 1, 5');
    });
  });

  describe('#computeCompositionKey', function() {
    it('should return just the base id when there are no ACL ids', function() {
      composed.computeCompositionKey('base1', []).should.equal('base1');
      composed.computeCompositionKey('base1', undefined).should.equal('base1');
    });

    it('should append a single ACL id after the base id', function() {
      composed
        .computeCompositionKey('base1', ['acl1'])
        .should.equal('base1:acl1');
    });

    it('should sort multiple ACL ids so selection order does not matter', function() {
      var forward = composed.computeCompositionKey('base1', [
        'acl2',
        'acl1',
        'acl3',
      ]);
      var reversed = composed.computeCompositionKey('base1', [
        'acl3',
        'acl1',
        'acl2',
      ]);
      forward.should.equal(reversed);
      forward.should.equal('base1:acl1,acl2,acl3');
    });

    it('should distinguish different ACL sets even with the same base', function() {
      var a = composed.computeCompositionKey('base1', ['acl1', 'acl2']);
      var b = composed.computeCompositionKey('base1', ['acl1', 'acl3']);
      a.should.not.equal(b);
    });
  });

  describe('#findInputNameCollisions', function() {
    it('should return no collisions when input names are disjoint', function() {
      var entries = [
        { label: 'base', html: '<input name="base_field">' },
        { label: 'acl1', html: '<input name="acl_field_a">' },
        { label: 'acl2', html: '<input name="acl_field_b">' },
      ];
      composed.findInputNameCollisions(entries).should.have.lengthOf(0);
    });

    it('should report a name shared by more than one entry', function() {
      var entries = [
        { label: 'base', html: '<input name="shared_field">' },
        { label: 'acl1', html: '<input name="acl_field_a">' },
        { label: 'acl2', html: '<input name="shared_field">' },
      ];
      var collisions = composed.findInputNameCollisions(entries);
      collisions.should.have.lengthOf(1);
      collisions[0].name.should.equal('shared_field');
      collisions[0].forms.should.have.members(['base', 'acl2']);
    });

    it('should ignore inputs without a name attribute', function() {
      var entries = [
        { label: 'base', html: '<input type="submit" value="go">' },
        { label: 'acl1', html: '<input type="submit" value="go">' },
      ];
      composed.findInputNameCollisions(entries).should.have.lengthOf(0);
    });
  });
});
