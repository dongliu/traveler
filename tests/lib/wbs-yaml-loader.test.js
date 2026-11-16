const sinon = require('sinon');
require('chai').should();

const loggers = require('../../lib/loggers');
const { loadWbsYaml } = require('../../lib/wbs-yaml-loader');
const fs = require('fs');

describe('lib/wbs-yaml-loader — loadWbsYaml', () => {
  let readFileStub;
  let loggerStub;

  beforeEach(() => {
    loggerStub = {
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };
    sinon.stub(loggers, 'getLogger').returns(loggerStub);
    readFileStub = sinon.stub(fs, 'readFileSync');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns a correct map for a valid file with multiple entries', () => {
    readFileStub.returns('1.2: team@example.com\n3.1: qa@example.com\n');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({ '1.2': 'team@example.com', '3.1': 'qa@example.com' });
    loggerStub.info.calledWithMatch('[wbs-yaml] Loaded 2').should.be.true;
  });

  it('returns {} and emits a debug log when the file is absent (ENOENT)', () => {
    const enoent = new Error('not found');
    enoent.code = 'ENOENT';
    readFileStub.throws(enoent);
    const result = loadWbsYaml('docker');
    result.should.deep.equal({});
    loggerStub.debug.calledWithMatch('[wbs-yaml]').should.be.true;
    loggerStub.error.called.should.be.false;
  });

  it('returns {} for an empty file', () => {
    readFileStub.returns('');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({});
  });

  it('returns {} for a file containing only comments', () => {
    readFileStub.returns('# just a comment\n');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({});
  });

  it('returns {} and logs an error with the file path when YAML is invalid', () => {
    readFileStub.returns('bad: yaml: content: :\n');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({});
    loggerStub.error.calledWithMatch('docker').should.be.true;
  });

  it('skips an entry with an invalid WBS number and logs a warning containing the key', () => {
    readFileStub.returns('1..2: a@example.com\n3.1: good@example.com\n');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({ '3.1': 'good@example.com' });
    const warnCall = loggerStub.warn.args.find(args => args[0].includes('1..2'));
    (warnCall !== undefined).should.be.true;
  });

  it('skips an entry with an invalid email and logs a warning containing the key and bad value', () => {
    readFileStub.returns('2.2: not-an-email\n2.3: valid@example.com\n');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({ '2.3': 'valid@example.com' });
    const warnCall = loggerStub.warn.args.find(
      args => args[0].includes('2.2') && args[0].includes('not-an-email')
    );
    (warnCall !== undefined).should.be.true;
  });

  it('returns {} and logs an error when YAML contains duplicate keys', () => {
    readFileStub.returns('1.2: first@example.com\n1.2: second@example.com\n');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({});
    loggerStub.error.calledWithMatch('[wbs-yaml]').should.be.true;
  });

  it('treats numeric-looking WBS keys as strings (FAILSAFE_SCHEMA)', () => {
    // Without FAILSAFE_SCHEMA: 1 → integer 1, 1.2 → float 1.2, 1.2.3 → string "1.2.3"
    // With FAILSAFE_SCHEMA: all three stay as strings
    readFileStub.returns('1: root@example.com\n1.2: child@example.com\n1.2.3: leaf@example.com\n');
    const result = loadWbsYaml('docker');
    result.should.deep.equal({
      '1': 'root@example.com',
      '1.2': 'child@example.com',
      '1.2.3': 'leaf@example.com',
    });
    Object.keys(result).forEach(k => (typeof k).should.equal('string'));
  });

  it('logs an error message containing the file path on YAML parse failure', () => {
    readFileStub.returns('bad: yaml: :\n');
    loadWbsYaml('/some/config/path');
    const errCall = loggerStub.error.args.find(args => args[0].includes('/some/config/path'));
    (errCall !== undefined).should.be.true;
  });
});
