var reqUtils = require('../../lib/req-utils');
require('chai').should();
var sinon = require('sinon');

describe('req-utils', function() {
  describe('#sanitize', function() {
    it('should sanitize a json object', function() {
      var req = {};
      var res = {};
      req.body = {
        a_string: 'has a <script>alert()</script>',
        a_function: function() {
          console.log('inside a function');
        },
        an_object: { deep: { deep: 'has a <script>alert()</script>' } },
        an_array: ['has a <script>alert()</script>', 'text'],
      };
      var nextSpy = sinon.spy();
      reqUtils.sanitize('body', [
        'a_string',
        'a_function',
        'an_object',
        'an_array',
      ])(req, res, nextSpy);
      nextSpy.calledOnce.should.be.true;
      req.body.a_string.includes('script').should.be.false;
      (req.body.a_function === null).should.be.true;
      req.body.an_object.deep.deep.includes('script').should.be.false;
      req.body.an_array[0].includes('script').should.be.false;
    });
  });
});
