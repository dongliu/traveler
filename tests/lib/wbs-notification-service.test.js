require('chai').should();
const sinon = require('sinon');

const config = require('../../config/config');
const {
  isValidWbsNumber,
  isValidEmail,
  listEntries,
  resolveWbsContact,
} = require('../../lib/wbs-notification-service');

// ── helpers ──────────────────────────────────────────────────────────────────

function withYaml(map, fn) {
  const original = config.wbsYaml;
  config.wbsYaml = map;
  try {
    return fn();
  } finally {
    config.wbsYaml = original;
  }
}

// ── format/email validators ─────────────────────────────────────────────────

describe('lib/wbs-notification-service — isValidWbsNumber', () => {
  it('accepts a single segment', () => {
    isValidWbsNumber('1').should.be.true;
  });

  it('accepts multiple dot-separated segments', () => {
    isValidWbsNumber('1.2.3').should.be.true;
  });

  it('accepts non-numeric segment contents', () => {
    isValidWbsNumber('WBS-A.b2.c-3').should.be.true;
  });

  it('rejects an empty string', () => {
    isValidWbsNumber('').should.be.false;
  });

  it('rejects consecutive dots', () => {
    isValidWbsNumber('1..2').should.be.false;
  });

  it('rejects a leading dot', () => {
    isValidWbsNumber('.1.2').should.be.false;
  });

  it('rejects a trailing dot', () => {
    isValidWbsNumber('1.2.').should.be.false;
  });

  it('rejects a non-string value', () => {
    isValidWbsNumber(undefined).should.be.false;
  });
});

describe('lib/wbs-notification-service — isValidEmail', () => {
  it('accepts a well-formed email', () => {
    isValidEmail('qa-lead@example.com').should.be.true;
  });

  it('rejects a string with no @', () => {
    isValidEmail('not-an-email').should.be.false;
  });

  it('rejects a string with no domain dot', () => {
    isValidEmail('user@localhost').should.be.false;
  });

  it('rejects a string containing whitespace', () => {
    isValidEmail('user @example.com').should.be.false;
  });
});

// ── listEntries ──────────────────────────────────────────────────────────────

describe('lib/wbs-notification-service — listEntries', () => {
  it('returns sorted entries from config.wbsYaml with source: config', () => {
    withYaml({ '3.1': 'c@example.com', '1.2': 'a@example.com' }, () => {
      const entries = listEntries();
      entries.should.deep.equal([
        { wbs_number: '1.2', notification_email: 'a@example.com', source: 'config' },
        { wbs_number: '3.1', notification_email: 'c@example.com', source: 'config' },
      ]);
    });
  });

  it('returns an empty array when config.wbsYaml is empty', () => {
    withYaml({}, () => {
      listEntries().should.deep.equal([]);
    });
  });

  it('returns an empty array when config.wbsYaml is undefined', () => {
    withYaml(undefined, () => {
      listEntries().should.deep.equal([]);
    });
  });
});

// ── resolveWbsContact ────────────────────────────────────────────────────────

describe('lib/wbs-notification-service — resolveWbsContact', () => {
  it('returns null for an empty/missing wbs number', () => {
    withYaml({}, () => {
      (resolveWbsContact('') === null).should.be.true;
      (resolveWbsContact(undefined) === null).should.be.true;
    });
  });

  it('returns the exact match when it exists', () => {
    withYaml({ '1.2': 'team@example.com' }, () => {
      const result = resolveWbsContact('1.2');
      result.wbs_number.should.equal('1.2');
      result.notification_email.should.equal('team@example.com');
      result.source.should.equal('config');
    });
  });

  it('falls back to the immediate parent when there is no exact match', () => {
    withYaml({ '1.2': 'parent@example.com' }, () => {
      const result = resolveWbsContact('1.2.1');
      result.wbs_number.should.equal('1.2');
    });
  });

  it('prefers the nearer ancestor when multiple ancestor levels are registered', () => {
    withYaml({ '1': 'root@example.com', '1.2': 'child@example.com' }, () => {
      const result = resolveWbsContact('1.2.1');
      result.wbs_number.should.equal('1.2');
    });
  });

  it('returns null when neither the exact number nor any ancestor is registered', () => {
    withYaml({ '2.1': 'other@example.com' }, () => {
      (resolveWbsContact('9.9.9') === null).should.be.true;
    });
  });

  it('trims surrounding whitespace before lookup', () => {
    withYaml({ '1.2': 'team@example.com' }, () => {
      const result = resolveWbsContact('  1.2  ');
      result.wbs_number.should.equal('1.2');
    });
  });

  it('returns null for a single-segment number with no match', () => {
    withYaml({}, () => {
      (resolveWbsContact('9') === null).should.be.true;
    });
  });
});
