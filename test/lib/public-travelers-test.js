var http = require('http');
var express = require('express');
var sinon = require('sinon');
var publicTravelers = require('../../lib/public-travelers');
var reqUtils = require('../../lib/req-utils');
var chai = require('chai');
var expect = chai.expect;
var should = chai.should();

/**
 * A fake Traveler model: only aggregate is provided, so a test also proves
 * the listing never uses any other model method. Each call is recorded.
 */
function fakeModel(itemRows, countRows, failWith) {
  var model = { calls: [] };
  model.aggregate = function aggregate(pipeline) {
    var isCounts = pipeline.some(function hasGroup(stage) {
      return stage.$group;
    });
    var call = { pipeline: pipeline, isCounts: isCounts, diskUse: false };
    model.calls.push(call);
    var aggregation = {
      allowDiskUse: function allowDiskUse(flag) {
        call.diskUse = flag;
        return aggregation;
      },
      exec: function exec() {
        if (failWith) {
          return Promise.reject(failWith);
        }
        return Promise.resolve(isCounts ? countRows : itemRows);
      },
    };
    return aggregation;
  };
  return model;
}

function itemsCall(model) {
  return model.calls.filter(function items(call) {
    return !call.isCounts;
  })[0];
}

/**
 * A tiny evaluator for the aggregation operators used by the counts $group
 * expression ($cond, $or, $eq, $in, field paths, literals), so a test can check
 * the database-side status expression against effectiveStatus.
 */
function evaluate(expr, doc) {
  if (typeof expr === 'string' && expr.charAt(0) === '$') {
    var value = doc[expr.slice(1)];
    return value === undefined ? null : value;
  }
  if (Array.isArray(expr)) {
    return expr;
  }
  if (expr === null || typeof expr !== 'object') {
    return expr;
  }
  var op = Object.keys(expr)[0];
  var args = expr[op];
  var values;
  if (op === '$cond') {
    return evaluate(args[0], doc)
      ? evaluate(args[1], doc)
      : evaluate(args[2], doc);
  }
  values = args.map(function ev(arg) {
    return evaluate(arg, doc);
  });
  if (op === '$or') {
    return values.some(Boolean);
  }
  if (op === '$eq') {
    return values[0] === values[1];
  }
  if (op === '$in') {
    return values[1].indexOf(values[0]) !== -1;
  }
  throw new Error('unsupported operator ' + op);
}

/**
 * A tiny evaluator for the query operators the listing's $match uses ($and,
 * $or, equality, $ne, $in, $nin, $exists, $gte, $lte, $regex with $options),
 * with MongoDB's rules for a missing field: null matches it, $ne and $nin
 * match it. It lets tests check what a match means, not only its shape.
 */
function matches(doc, cond) {
  return Object.keys(cond).every(function test(key) {
    var want = cond[key];
    if (key === '$and') {
      return want.every(function each(c) {
        return matches(doc, c);
      });
    }
    if (key === '$or') {
      return want.some(function some(c) {
        return matches(doc, c);
      });
    }
    var have = doc[key];
    var isOperators =
      want !== null &&
      typeof want === 'object' &&
      !(want instanceof Date) &&
      !Array.isArray(want);
    if (!isOperators) {
      if (want === null) {
        return have === undefined || have === null;
      }
      if (Array.isArray(have)) {
        return have.indexOf(want) !== -1;
      }
      return have === want;
    }
    var values = Array.isArray(have) ? have : [have];
    return Object.keys(want).every(function op(name) {
      var arg = want[name];
      if (name === '$ne') {
        return have !== arg;
      }
      if (name === '$in') {
        // a missing field matches null, as in MongoDB
        return arg.indexOf(have === undefined ? null : have) !== -1;
      }
      if (name === '$nin') {
        return arg.indexOf(have) === -1;
      }
      if (name === '$exists') {
        return (have !== undefined) === arg;
      }
      if (name === '$gte') {
        return (
          have !== undefined && have !== null && have.getTime() >= arg.getTime()
        );
      }
      if (name === '$lte') {
        return (
          have !== undefined && have !== null && have.getTime() <= arg.getTime()
        );
      }
      if (name === '$regex') {
        var re = new RegExp(arg, want.$options);
        return values.some(function some(v) {
          return typeof v === 'string' && re.test(v);
        });
      }
      if (name === '$options') {
        return true;
      }
      throw new Error('unsupported operator ' + name);
    });
  });
}

describe('public-travelers', function() {
  describe('#effectiveStatus', function() {
    it('should report each stored status under its name', function() {
      [
        [0, 'initialized'],
        [1, 'active'],
        [1.5, 'submitted for completion'],
        [2, 'completed'],
        [3, 'frozen'],
      ].forEach(function(pair) {
        var result = publicTravelers.effectiveStatus({ status: pair[0] });
        result.code.should.equal(pair[0]);
        result.name.should.equal(pair[1]);
      });
    });

    it('should report a traveler with the archived flag as archived, whatever its status', function() {
      [0, 1, 1.5, 2, 3, undefined].forEach(function(status) {
        var result = publicTravelers.effectiveStatus({
          status: status,
          archived: true,
        });
        result.code.should.equal(4);
        result.name.should.equal('archived');
      });
    });

    it('should report status 4 without the flag as archived', function() {
      var result = publicTravelers.effectiveStatus({ status: 4 });
      result.code.should.equal(4);
      result.name.should.equal('archived');
    });

    it('should not treat archived: false as archived', function() {
      publicTravelers
        .effectiveStatus({ status: 2, archived: false })
        .name.should.equal('completed');
    });

    it('should treat a missing or unrecognized status as initialized', function() {
      [{}, { status: null }, { status: 'x' }, { status: 7 }].forEach(function(
        doc
      ) {
        var result = publicTravelers.effectiveStatus(doc);
        result.code.should.equal(0);
        result.name.should.equal('initialized');
      });
    });
  });

  describe('#toRecord', function() {
    var KEYS = [
      '_id',
      'title',
      'status',
      'statusCode',
      'createdBy',
      'createdOn',
      'updatedBy',
      'updatedOn',
      'archivedOn',
      'owner',
      'tags',
      'totalInput',
      'finishedInput',
      'subsystem',
      'device',
      'activity',
      'machineArea',
      'sector',
      'windchillId',
    ];

    it('should include every key, in order, for an empty document', function() {
      var record = publicTravelers.toRecord({});
      Object.keys(record).should.deep.equal(KEYS);
      record.title.should.equal('');
      expect(record.createdOn).to.equal(null);
      expect(record.updatedOn).to.equal(null);
      expect(record.archivedOn).to.equal(null);
      record.tags.should.deep.equal([]);
      record.totalInput.should.equal(0);
      record.finishedInput.should.equal(0);
      record.status.should.equal('initialized');
      record.statusCode.should.equal(0);
    });

    it('should keep the stored values of a full document', function() {
      var created = new Date('2026-08-30T14:02:11.000Z');
      var updated = new Date('2026-09-14T09:41:03.000Z');
      var record = publicTravelers.toRecord({
        _id: 'abc',
        title: 'Cryomodule leak check',
        status: 1,
        createdBy: 'liud',
        createdOn: created,
        updatedBy: 'smith',
        updatedOn: updated,
        owner: 'jones',
        tags: ['leak-check', 'vacuum'],
        totalInput: 36,
        finishedInput: 12,
        subsystem: 'Cryogenics',
        device: 'CM-02',
        activity: 'Acceptance test',
        machineArea: 'Linac tunnel',
        sector: 'S4',
        windchillId: 'WC-0012345',
      });
      record._id.should.equal('abc');
      record.status.should.equal('active');
      record.createdOn.should.equal(created);
      record.updatedOn.should.equal(updated);
      record.owner.should.equal('jones');
      record.tags.should.deep.equal(['leak-check', 'vacuum']);
      record.totalInput.should.equal(36);
      record.finishedInput.should.equal(12);
      record.windchillId.should.equal('WC-0012345');
    });

    it('should fall back to the creator when there is no owner', function() {
      publicTravelers
        .toRecord({ createdBy: 'liud' })
        .owner.should.equal('liud');
      publicTravelers
        .toRecord({ createdBy: 'liud', owner: '' })
        .owner.should.equal('liud');
      publicTravelers.toRecord({}).owner.should.equal('');
    });

    it('should report archivedOn only while the traveler is marked archived', function() {
      var stale = new Date('2026-01-01T00:00:00.000Z');
      var restored = publicTravelers.toRecord({
        archived: false,
        archivedOn: stale,
      });
      expect(restored.archivedOn).to.equal(null);
      var archived = publicTravelers.toRecord({
        archived: true,
        archivedOn: stale,
      });
      archived.archivedOn.getTime().should.equal(stale.getTime());
      var noDate = publicTravelers.toRecord({ archived: true });
      expect(noDate.archivedOn).to.equal(null);
    });

    it('should report status 4 without the flag as archived, with no archive date', function() {
      var record = publicTravelers.toRecord({
        status: 4,
        archivedOn: new Date(),
      });
      record.status.should.equal('archived');
      record.statusCode.should.equal(4);
      expect(record.archivedOn).to.equal(null);
    });

    it('should keep statusCode in step with status', function() {
      [0, 1, 1.5, 2, 3, 4].forEach(function(status) {
        var record = publicTravelers.toRecord({ status: status });
        record.statusCode.should.equal(status);
      });
    });

    it('should accept dates given as strings and drop invalid ones', function() {
      var record = publicTravelers.toRecord({
        createdOn: '2026-08-30T14:02:11.000Z',
        updatedOn: 'not a date',
      });
      record.createdOn.toISOString().should.equal('2026-08-30T14:02:11.000Z');
      expect(record.updatedOn).to.equal(null);
    });

    it('should not alias the stored tags array', function() {
      var tags = ['a'];
      var record = publicTravelers.toRecord({ tags: tags });
      record.tags.push('b');
      tags.should.deep.equal(['a']);
    });

    it('should replace non-text and non-numeric values with blanks', function() {
      var record = publicTravelers.toRecord({
        title: 5,
        subsystem: { $ne: 'x' },
        totalInput: 'many',
        tags: 'not-an-array',
      });
      record.title.should.equal('');
      record.subsystem.should.equal('');
      record.totalInput.should.equal(0);
      record.tags.should.deep.equal([]);
    });
  });

  describe('#readString', function() {
    it('should return an empty string for a missing or blank value', function() {
      publicTravelers.readString({}, 'device').should.equal('');
      publicTravelers.readString({ device: null }, 'device').should.equal('');
      publicTravelers.readString({ device: '   ' }, 'device').should.equal('');
    });

    it('should return the trimmed value', function() {
      publicTravelers
        .readString({ device: '  CM-02 ' }, 'device')
        .should.equal('CM-02');
    });

    it('should reject an object, as Express builds from device[$ne]=x', function() {
      var thrown;
      try {
        publicTravelers.readString({ device: { $ne: 'x' } }, 'device');
      } catch (e) {
        thrown = e;
      }
      thrown.should.be.an('error');
      thrown.status.should.equal(400);
      thrown.message.should.include('device');
    });

    it('should reject an array, since only a single value is accepted', function() {
      var thrown;
      try {
        publicTravelers.readString({ device: ['a', 'b'] }, 'device');
      } catch (e) {
        thrown = e;
      }
      thrown.status.should.equal(400);
    });
  });

  describe('#readList', function() {
    it('should return an empty list for a missing or blank value', function() {
      publicTravelers.readList({}, 'tags').should.deep.equal([]);
      publicTravelers.readList({ tags: '' }, 'tags').should.deep.equal([]);
      publicTravelers.readList({ tags: ' , ,' }, 'tags').should.deep.equal([]);
    });

    it('should split a comma-separated value and trim each part', function() {
      publicTravelers
        .readList({ tags: 'leak-check, vacuum ,cold' }, 'tags')
        .should.deep.equal(['leak-check', 'vacuum', 'cold']);
    });

    it('should accept a repeated parameter', function() {
      publicTravelers
        .readList({ status: ['active', '1.5'] }, 'status')
        .should.deep.equal(['active', '1.5']);
    });

    it('should accept a repeated parameter whose parts are comma-separated', function() {
      publicTravelers
        .readList({ tags: ['a,b', 'c'] }, 'tags')
        .should.deep.equal(['a', 'b', 'c']);
    });

    it('should reject an object with a message naming the parameter', function() {
      var thrown;
      try {
        publicTravelers.readList({ status: { $gt: '1' } }, 'status');
      } catch (e) {
        thrown = e;
      }
      thrown.should.be.an('error');
      thrown.status.should.equal(400);
      thrown.message.should.include('status');
    });

    it('should reject an object inside an array', function() {
      var thrown;
      try {
        publicTravelers.readList({ tags: ['a', { $ne: 'b' }] }, 'tags');
      } catch (e) {
        thrown = e;
      }
      thrown.status.should.equal(400);
    });
  });

  describe('#parsePaging', function() {
    function rejects(query) {
      var thrown;
      try {
        publicTravelers.parsePaging(query);
      } catch (e) {
        thrown = e;
      }
      thrown.should.be.an('error');
      thrown.status.should.equal(400);
      return thrown;
    }

    it('should default to page 1 with 25 per page, not paged', function() {
      publicTravelers.parsePaging({}).should.deep.equal({
        page: 1,
        limit: 25,
        paged: false,
      });
    });

    it('should read page and limit', function() {
      publicTravelers
        .parsePaging({ page: '3', limit: '50' })
        .should.deep.equal({ page: 3, limit: 50, paged: true });
    });

    it('should count either option as paging', function() {
      publicTravelers.parsePaging({ limit: '10' }).paged.should.be.true;
      publicTravelers.parsePaging({ page: '2' }).paged.should.be.true;
    });

    it('should ignore blank values', function() {
      publicTravelers
        .parsePaging({ page: '', limit: ' ' })
        .should.deep.equal({ page: 1, limit: 25, paged: false });
    });

    it('should reduce a limit above the maximum to the maximum', function() {
      publicTravelers.parsePaging({ limit: '9999' }).limit.should.equal(500);
      publicTravelers.parsePaging({ limit: '500' }).limit.should.equal(500);
      publicTravelers
        .parsePaging({ limit: '99999999999999999999' })
        .limit.should.equal(500);
    });

    it('should reject an invalid page, naming the parameter', function() {
      ['0', '-1', 'abc', '1.5', '100001', '1e3', '2 3'].forEach(function(page) {
        rejects({ page: page }).message.should.include('page');
      });
      publicTravelers.parsePaging({ page: '100000' }).page.should.equal(100000);
    });

    it('should reject an invalid limit, naming the parameter', function() {
      ['0', '-5', 'x', '2.5'].forEach(function(limit) {
        rejects({ limit: limit }).message.should.include('limit');
      });
    });

    it('should reject a page or limit that is not a single text value', function() {
      rejects({ page: { $gt: '0' } });
      rejects({ limit: ['1', '2'] });
    });
  });

  describe('#parseListQuery', function() {
    it('should return the paging fields with no filters', function() {
      publicTravelers
        .parseListQuery({ page: '2', limit: '10' })
        .should.deep.equal({
          format: 'json',
          page: 2,
          limit: 10,
          paged: true,
          updatedFrom: null,
          updatedTo: null,
          textFilters: {},
          tags: [],
          statuses: [],
          includeArchived: false,
        });
    });

    it('should accept a missing query', function() {
      publicTravelers.parseListQuery(undefined).page.should.equal(1);
      publicTravelers.parseListQuery(null).limit.should.equal(25);
    });

    it('should reject an invalid page', function() {
      expect(function() {
        publicTravelers.parseListQuery({ page: '0' });
      }).to.throw(/page/);
    });
  });

  describe('#buildBaseMatch', function() {
    it('should start with the shared public-tier match, unchanged', function() {
      var match = publicTravelers.buildBaseMatch({ includeArchived: false });
      match.$and[0].should.deep.equal(reqUtils.publicAccessMatch());
    });

    it('should exclude archived travelers unless they are included', function() {
      var excluded = publicTravelers.buildBaseMatch({ includeArchived: false });
      excluded.$and.should.deep.include({ archived: { $ne: true } });
      excluded.$and.should.deep.include({ status: { $ne: 4 } });
      var included = publicTravelers.buildBaseMatch({ includeArchived: true });
      included.$and.should.deep.equal([reqUtils.publicAccessMatch()]);
    });

    it('should not let any parameter change the public-tier match', function() {
      var match = publicTravelers.buildBaseMatch({
        includeArchived: true,
        publicAccess: -1,
        $and: [],
        public: false,
      });
      match.$and[0].should.deep.equal(reqUtils.publicAccessMatch());
      match.$and.length.should.equal(1);
    });
  });

  describe('#buildItemsPipeline', function() {
    var params = { page: 3, limit: 25, paged: true, includeArchived: false };

    it('should match first, then project, sort, skip, and limit', function() {
      var pipeline = publicTravelers.buildItemsPipeline(params);
      pipeline
        .map(function(stage) {
          return Object.keys(stage)[0];
        })
        .should.deep.equal(['$match', '$project', '$sort', '$skip', '$limit']);
      pipeline[0].$match.should.deep.equal(
        publicTravelers.buildBaseMatch(params)
      );
    });

    it('should project only the record fields and the sort key, never forms', function() {
      var project = publicTravelers.buildItemsPipeline(params)[1].$project;
      Object.keys(project)
        .sort()
        .should.deep.equal(
          publicTravelers.RECORD_FIELDS.concat(['_sortKey']).sort()
        );
      project.should.not.have.property('forms');
      project.should.not.have.property('data');
      project._sortKey.should.deep.equal({
        $ifNull: ['$updatedOn', '$createdOn'],
      });
    });

    it('should sort newest first with the id as tie-break', function() {
      publicTravelers
        .buildItemsPipeline(params)[2]
        .$sort.should.deep.equal({ _sortKey: -1, _id: -1 });
    });

    it('should skip and limit by page', function() {
      var pipeline = publicTravelers.buildItemsPipeline(params);
      pipeline[3].should.deep.equal({ $skip: 50 });
      pipeline[4].should.deep.equal({ $limit: 25 });
    });

    it('should not skip on the first page', function() {
      var pipeline = publicTravelers.buildItemsPipeline({
        page: 1,
        limit: 10,
        paged: true,
        includeArchived: false,
      });
      pipeline.length.should.equal(4);
      pipeline[3].should.deep.equal({ $limit: 10 });
    });

    it('should return every match when not paged', function() {
      var pipeline = publicTravelers.buildItemsPipeline({
        page: 1,
        limit: 25,
        paged: false,
        includeArchived: false,
      });
      pipeline
        .map(function(stage) {
          return Object.keys(stage)[0];
        })
        .should.deep.equal(['$match', '$project', '$sort']);
    });
  });

  describe('#buildCountsPipeline', function() {
    var params = { includeArchived: false, statuses: [] };

    it('should match, then group by effective status', function() {
      var pipeline = publicTravelers.buildCountsPipeline(params);
      pipeline.length.should.equal(2);
      pipeline[0].$match.should.deep.equal(
        publicTravelers.buildBaseMatch(params)
      );
      pipeline[1].$group.n.should.deep.equal({ $sum: 1 });
    });

    it('should group the way effectiveStatus classifies a traveler', function() {
      var expression = publicTravelers.buildCountsPipeline(params)[1].$group
        ._id;
      [
        {},
        { status: null },
        { status: 0 },
        { status: 1 },
        { status: 1.5 },
        { status: 2 },
        { status: 3 },
        { status: 4 },
        { status: 7 },
        { status: 'x' },
        { archived: true, status: 2 },
        { archived: true },
        { archived: false, status: 2 },
      ].forEach(function(doc) {
        evaluate(expression, doc).should.equal(
          publicTravelers.effectiveStatus(doc).code,
          JSON.stringify(doc)
        );
      });
    });

    it('should build a fresh expression each time', function() {
      var first = publicTravelers.buildCountsPipeline(params);
      first[1].$group._id.$cond[2].$cond[0].$in[1].push(99);
      publicTravelers
        .buildCountsPipeline(params)[1]
        .$group._id.$cond[2].$cond[0].$in[1].should.deep.equal([1, 1.5, 2, 3]);
    });
  });

  describe('#summarizeCounts', function() {
    var rows = [
      { _id: 1, n: 3 },
      { _id: 0, n: 2 },
      { _id: 2, n: 5 },
    ];

    it('should sum every status when none is requested', function() {
      publicTravelers.summarizeCounts(rows, [], false).total.should.equal(10);
    });

    it('should name every status in order, with zero for an empty one', function() {
      var result = publicTravelers.summarizeCounts(rows, [], false);
      Object.keys(result.statusCounts).should.deep.equal([
        'initialized',
        'active',
        'submitted for completion',
        'completed',
        'frozen',
      ]);
      result.statusCounts.should.deep.equal({
        initialized: 2,
        active: 3,
        'submitted for completion': 0,
        completed: 5,
        frozen: 0,
      });
    });

    it('should leave out the archived count unless archived travelers are included', function() {
      publicTravelers
        .summarizeCounts(rows.concat([{ _id: 4, n: 9 }]), [], false)
        .statusCounts.should.not.have.property('archived');
      var included = publicTravelers.summarizeCounts(rows, [], true);
      included.statusCounts.archived.should.equal(0);
      publicTravelers
        .summarizeCounts(rows.concat([{ _id: 4, n: 9 }]), [], true)
        .statusCounts.archived.should.equal(9);
    });

    it('should total only the requested statuses', function() {
      publicTravelers.summarizeCounts(rows, [1], false).total.should.equal(3);
      publicTravelers
        .summarizeCounts(rows, [1, 2], false)
        .total.should.equal(8);
      publicTravelers.summarizeCounts(rows, [3], false).total.should.equal(0);
    });

    it('should keep the counts of every status whatever is requested', function() {
      publicTravelers
        .summarizeCounts(rows, [1], false)
        .statusCounts.completed.should.equal(5);
    });

    it('should count the 1.5 status', function() {
      var result = publicTravelers.summarizeCounts(
        [{ _id: 1.5, n: 4 }],
        [],
        false
      );
      result.statusCounts['submitted for completion'].should.equal(4);
      result.total.should.equal(4);
    });

    it('should handle no rows', function() {
      var result = publicTravelers.summarizeCounts([], [], false);
      result.total.should.equal(0);
    });
  });

  describe('#list', function() {
    var params = {
      page: 1,
      limit: 25,
      paged: true,
      statuses: [],
      includeArchived: false,
    };

    it('should return the records, paging, total, and status counts', function() {
      var model = fakeModel(
        [
          { _id: 'a', title: 'A', status: 1 },
          { _id: 'b', title: 'B', status: 2 },
        ],
        [
          { _id: 1, n: 1 },
          { _id: 2, n: 1 },
        ]
      );
      return publicTravelers.list(model, params).then(function(result) {
        Object.keys(result).should.deep.equal([
          'travelers',
          'page',
          'limit',
          'total',
          'statusCounts',
        ]);
        result.travelers
          .map(function(t) {
            return t.title + ':' + t.status;
          })
          .should.deep.equal(['A:active', 'B:completed']);
        result.page.should.equal(1);
        result.limit.should.equal(25);
        result.total.should.equal(2);
        result.statusCounts.active.should.equal(1);
      });
    });

    it('should run the items and counts pipelines, both allowed to use disk', function() {
      var model = fakeModel([], []);
      return publicTravelers.list(model, params).then(function() {
        model.calls.length.should.equal(2);
        model.calls
          .filter(function(c) {
            return c.isCounts;
          })
          .length.should.equal(1);
        model.calls.forEach(function(call) {
          call.diskUse.should.be.true;
        });
      });
    });

    it('should use the requested statuses for the total', function() {
      var model = fakeModel(
        [],
        [
          { _id: 1, n: 3 },
          { _id: 2, n: 5 },
        ]
      );
      var withStatus = Object.assign({}, params, { statuses: [2] });
      return publicTravelers.list(model, withStatus).then(function(result) {
        result.total.should.equal(5);
        result.statusCounts.active.should.equal(3);
      });
    });

    it('should reject when the database fails', function() {
      var model = fakeModel([], [], new Error('db down'));
      return publicTravelers.list(model, params).then(
        function() {
          throw new Error('should have rejected');
        },
        function(err) {
          err.message.should.equal('db down');
        }
      );
    });
  });

  describe('#listHandler (real HTTP)', function() {
    var server;
    var port;
    var errorStub;

    function start(model) {
      var app = express();
      app.get('/list', publicTravelers.listHandler(model));
      return new Promise(function(resolve) {
        server = http.createServer(app).listen(0, '127.0.0.1', function() {
          port = server.address().port;
          resolve();
        });
      });
    }

    function get(path) {
      return new Promise(function(resolve, reject) {
        http
          .get({ host: '127.0.0.1', port: port, path: path }, function(res) {
            var chunks = [];
            res.on('data', function(chunk) {
              chunks.push(chunk);
            });
            res.on('end', function() {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                text: Buffer.concat(chunks).toString('utf8'),
              });
            });
          })
          .on('error', reject);
      });
    }

    beforeEach(function() {
      errorStub = sinon.stub(require('../../lib/loggers').getLogger(), 'error');
    });

    afterEach(function() {
      errorStub.restore();
      return new Promise(function(resolve) {
        if (!server) {
          return resolve();
        }
        return server.close(resolve);
      });
    });

    it('should answer a request with the JSON envelope', function() {
      var model = fakeModel(
        [{ _id: 'a', title: 'A', status: 1, createdBy: 'liud' }],
        [{ _id: 1, n: 1 }]
      );
      return start(model)
        .then(function() {
          return get('/list');
        })
        .then(function(res) {
          res.status.should.equal(200);
          res.headers['content-type'].should.include('application/json');
          var body = JSON.parse(res.text);
          Object.keys(body).should.deep.equal([
            'travelers',
            'page',
            'limit',
            'total',
            'statusCounts',
          ]);
          body.page.should.equal(1);
          body.limit.should.equal(25);
          body.total.should.equal(1);
          Object.keys(body.travelers[0]).should.deep.equal([
            '_id',
            'title',
            'status',
            'statusCode',
            'createdBy',
            'createdOn',
            'updatedBy',
            'updatedOn',
            'archivedOn',
            'owner',
            'tags',
            'totalInput',
            'finishedInput',
            'subsystem',
            'device',
            'activity',
            'machineArea',
            'sector',
            'windchillId',
          ]);
          body.travelers[0].owner.should.equal('liud');
          model.calls.length.should.equal(2);
        });
    });

    it('should page the items pipeline from page and limit', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?page=2&limit=10');
        })
        .then(function(res) {
          res.status.should.equal(200);
          var pipeline = itemsCall(model).pipeline;
          pipeline.should.deep.include({ $skip: 10 });
          pipeline.should.deep.include({ $limit: 10 });
        });
    });

    it('should page by default even when no paging is given', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list');
        })
        .then(function() {
          itemsCall(model).pipeline.should.deep.include({ $limit: 25 });
        });
    });

    it('should reject limit=0 with a JSON error and no database call', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?limit=0');
        })
        .then(function(res) {
          res.status.should.equal(400);
          res.headers['content-type'].should.include('application/json');
          JSON.parse(res.text).error.should.include('limit');
          model.calls.length.should.equal(0);
        });
    });

    it('should reject a bad page with a JSON error', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?page=abc');
        })
        .then(function(res) {
          res.status.should.equal(400);
          JSON.parse(res.text).error.should.include('page');
          model.calls.length.should.equal(0);
        });
    });

    it('should reduce limit=9999 to 500 and report it', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?limit=9999');
        })
        .then(function(res) {
          res.status.should.equal(200);
          JSON.parse(res.text).limit.should.equal(500);
          itemsCall(model).pipeline.should.deep.include({ $limit: 500 });
        });
    });

    it('should answer 500 with a generic message when the database fails', function() {
      var model = fakeModel([], [], new Error('secret connection string'));
      return start(model)
        .then(function() {
          return get('/list');
        })
        .then(function(res) {
          res.status.should.equal(500);
          JSON.parse(res.text).should.deep.equal({ error: 'internal error' });
          res.text.should.not.include('secret');
          errorStub.called.should.be.true;
        });
    });
  });

  describe('#parseDateBound', function() {
    it('should return null for a blank value', function() {
      expect(
        publicTravelers.parseDateBound('', 'from', 'updatedFrom')
      ).to.equal(null);
    });

    it('should take a lower-bound date as the start of that local day', function() {
      var date = publicTravelers.parseDateBound(
        '2026-09-01',
        'from',
        'updatedFrom'
      );
      date.getTime().should.equal(new Date(2026, 8, 1, 0, 0, 0, 0).getTime());
    });

    it('should take an upper-bound date as the last millisecond of that local day', function() {
      var date = publicTravelers.parseDateBound(
        '2026-09-15',
        'to',
        'updatedTo'
      );
      date
        .getTime()
        .should.equal(new Date(2026, 8, 15, 23, 59, 59, 999).getTime());
    });

    it('should use an ISO 8601 timestamp exactly', function() {
      publicTravelers
        .parseDateBound('2026-09-01T10:30:00Z', 'to', 'updatedTo')
        .getTime()
        .should.equal(Date.UTC(2026, 8, 1, 10, 30, 0));
      publicTravelers
        .parseDateBound('2026-09-01T10:30:00.250+02:00', 'from', 'updatedFrom')
        .getTime()
        .should.equal(Date.UTC(2026, 8, 1, 8, 30, 0, 250));
    });

    it('should reject a value that is not a date, naming the parameter', function() {
      [
        'nope',
        '2026-13-01',
        '2026-02-30',
        '2026-9-1',
        '0099-01-01',
        '2026-09-01T25:00:00Z',
        '2026-09-01 10:00',
        '1 Sep 2026',
        'DROP TABLE',
      ].forEach(function(raw) {
        expect(function() {
          publicTravelers.parseDateBound(raw, 'from', 'updatedFrom');
        }, raw).to.throw(/updatedFrom must be a date/);
      });
    });
  });

  describe('#parseListQuery filters', function() {
    var parse = publicTravelers.parseListQuery;

    function rejects(query) {
      var thrown;
      try {
        parse(query);
      } catch (e) {
        thrown = e;
      }
      expect(thrown, JSON.stringify(query)).to.be.an('error');
      thrown.status.should.equal(400);
      return thrown;
    }

    it('should read the update range', function() {
      var params = parse({
        updatedFrom: '2026-09-01',
        updatedTo: '2026-09-15',
      });
      params.updatedFrom.getTime().should.equal(new Date(2026, 8, 1).getTime());
      params.updatedTo
        .getTime()
        .should.equal(new Date(2026, 8, 15, 23, 59, 59, 999).getTime());
    });

    it('should accept a range with only one end', function() {
      expect(parse({ updatedFrom: '2026-09-01' }).updatedTo).to.equal(null);
      expect(parse({ updatedTo: '2026-09-01' }).updatedFrom).to.equal(null);
    });

    it('should accept a range whose ends are the same day', function() {
      parse({ updatedFrom: '2026-09-01', updatedTo: '2026-09-01' });
    });

    it('should reject a start after the end', function() {
      rejects({
        updatedFrom: '2026-09-15',
        updatedTo: '2026-09-01',
      }).message.should.include('updatedFrom must not be after updatedTo');
    });

    it('should reject an invalid date, naming the parameter', function() {
      rejects({ updatedTo: 'soon' }).message.should.include('updatedTo');
    });

    it('should read the six text filters, trimmed, and ignore blanks', function() {
      var params = parse({
        subsystem: ' cryo ',
        device: '',
        activity: '   ',
        machineArea: 'tunnel',
        sector: 'S4',
        windchillId: 'WC-1',
      });
      params.textFilters.should.deep.equal({
        subsystem: 'cryo',
        machineArea: 'tunnel',
        sector: 'S4',
        windchillId: 'WC-1',
      });
    });

    it('should accept a text filter of exactly 200 characters and reject 201', function() {
      parse({ subsystem: new Array(201).join('a') });
      rejects({ subsystem: new Array(202).join('a') }).message.should.include(
        'subsystem must be at most 200 characters'
      );
    });

    it('should reject an operator object in any filter', function() {
      [
        { subsystem: { $ne: 'x' } },
        { device: { $gt: '' } },
        { activity: ['a', 'b'] },
        { machineArea: { $regex: '.*' } },
        { sector: { $exists: true } },
        { windchillId: { $where: '1' } },
        { status: { $gt: '1' } },
        { status: [{ $ne: 'x' }] },
        { tags: { $ne: 'a' } },
        { tags: ['a', { $ne: 'b' }] },
        { updatedFrom: { $gt: '' } },
        { updatedTo: ['2026-09-01'] },
        { includeArchived: { $ne: '' } },
        { page: { $gt: '0' } },
      ].forEach(rejects);
    });

    it('should read status names in any case and numeric codes', function() {
      parse({ status: 'ACTIVE' }).statuses.should.deep.equal([1]);
      parse({ status: 'submitted for completion' }).statuses.should.deep.equal([
        1.5,
      ]);
      parse({
        status: 'Submitted  For   Completion',
      }).statuses.should.deep.equal([1.5]);
      parse({ status: '1.5' }).statuses.should.deep.equal([1.5]);
      parse({ status: '0' }).statuses.should.deep.equal([0]);
      parse({ status: 'frozen,3' }).statuses.should.deep.equal([3]);
    });

    it('should read several statuses, comma-separated or repeated, without repeats', function() {
      parse({ status: 'active,completed' }).statuses.should.deep.equal([1, 2]);
      parse({ status: ['active', '1.5'] }).statuses.should.deep.equal([1, 1.5]);
      parse({ status: 'active,1,ACTIVE' }).statuses.should.deep.equal([1]);
    });

    it('should reject an unknown status with a message listing what is accepted', function() {
      ['done', '5', '-1', '1.25', 'x,active', '1e1'].forEach(function(status) {
        var message = rejects({ status: status }).message;
        message.should.include('unknown status');
        message.should.include(
          'initialized, active, submitted for completion, completed, frozen, archived'
        );
        message.should.include('0, 1, 1.5, 2, 3, 4');
      });
    });

    it('should not echo an over-long status value in full', function() {
      var message = rejects({ status: new Array(200).join('z') }).message;
      message.length.should.be.below(250);
    });

    it('should read tags, dropping blanks and case-insensitive repeats', function() {
      parse({ tags: 'leak-check, Vacuum ,,' }).tags.should.deep.equal([
        'leak-check',
        'Vacuum',
      ]);
      parse({ tags: ['a', 'A,b'] }).tags.should.deep.equal(['a', 'b']);
      parse({ tags: '__proto__,__proto__' }).tags.should.deep.equal([
        '__proto__',
      ]);
    });

    it('should reject an over-long tag', function() {
      rejects({ tags: new Array(202).join('t') }).message.should.include('tag');
    });

    it('should read includeArchived', function() {
      ['true', '1', 'TRUE', ' True '].forEach(function(value) {
        parse({ includeArchived: value }).includeArchived.should.be.true;
      });
      ['false', '0', '', 'FALSE'].forEach(function(value) {
        parse({ includeArchived: value }).includeArchived.should.be.false;
      });
      rejects({ includeArchived: 'yes' }).message.should.include(
        'includeArchived'
      );
    });

    it('should include archived travelers when the status filter asks for them', function() {
      parse({ status: 'archived' }).includeArchived.should.be.true;
      parse({ status: '4', includeArchived: 'false' }).includeArchived.should.be
        .true;
      parse({ status: 'active,archived' }).includeArchived.should.be.true;
      parse({ status: 'active' }).includeArchived.should.be.false;
    });

    it('should ignore every blank filter', function() {
      var params = parse({
        updatedFrom: '',
        updatedTo: ' ',
        subsystem: '',
        tags: '',
        status: '',
        includeArchived: '',
      });
      expect(params.updatedFrom).to.equal(null);
      expect(params.updatedTo).to.equal(null);
      params.textFilters.should.deep.equal({});
      params.tags.should.deep.equal([]);
      params.statuses.should.deep.equal([]);
      params.includeArchived.should.be.false;
    });
  });

  describe('#buildBaseMatch filters', function() {
    var NEVER_EDITED = { createdOn: new Date(2026, 8, 10) };
    var EDITED = {
      createdOn: new Date(2026, 7, 1),
      updatedOn: new Date(2026, 8, 5),
    };

    function baseParams(over) {
      return Object.assign({ includeArchived: false }, over);
    }

    it('should add nothing for absent or blank filters', function() {
      var match = publicTravelers.buildBaseMatch(
        baseParams({
          updatedFrom: null,
          updatedTo: null,
          textFilters: {},
          tags: [],
        })
      );
      match.$and.length.should.equal(3);
    });

    it('should match an update range on updatedOn, or on createdOn when never edited', function() {
      var from = new Date(2026, 8, 1);
      var to = new Date(2026, 8, 15, 23, 59, 59, 999);
      var match = publicTravelers.buildBaseMatch(
        baseParams({ updatedFrom: from, updatedTo: to })
      );
      var range = match.$and[3];
      range.should.deep.equal({
        $or: [
          { updatedOn: { $gte: from, $lte: to } },
          { updatedOn: null, createdOn: { $gte: from, $lte: to } },
        ],
      });
      range.$or[0].updatedOn.should.not.equal(range.$or[1].createdOn);
    });

    it('should leave out a bound that is not given', function() {
      var from = new Date(2026, 8, 1);
      var range = publicTravelers.buildBaseMatch(
        baseParams({ updatedFrom: from })
      ).$and[3];
      range.$or[0].updatedOn.should.deep.equal({ $gte: from });
      range.$or[1].createdOn.should.deep.equal({ $gte: from });
    });

    it('should apply the range to the update time, or the creation time when never edited', function() {
      var range = publicTravelers.buildBaseMatch(
        baseParams({
          updatedFrom: new Date(2026, 8, 1),
          updatedTo: new Date(2026, 8, 15, 23, 59, 59, 999),
        })
      );
      matches(Object.assign({ publicAccess: 0 }, EDITED), range).should.be.true;
      matches(Object.assign({ publicAccess: 0 }, NEVER_EDITED), range).should.be
        .true;
      matches(
        {
          publicAccess: 0,
          createdOn: new Date(2026, 6, 1),
          updatedOn: new Date(2026, 6, 2),
        },
        range
      ).should.be.false;
      // a traveler that has been edited is placed by its update, not its creation
      matches(
        {
          publicAccess: 0,
          createdOn: new Date(2026, 8, 5),
          updatedOn: new Date(2026, 9, 5),
        },
        range
      ).should.be.false;
    });

    it('should include the whole last day of the range', function() {
      var range = publicTravelers.buildBaseMatch(
        baseParams({
          updatedFrom: new Date(2026, 8, 1),
          updatedTo: publicTravelers.parseDateBound(
            '2026-09-15',
            'to',
            'updatedTo'
          ),
        })
      );
      matches(
        { publicAccess: 0, updatedOn: new Date(2026, 8, 15, 18, 30) },
        range
      ).should.be.true;
      matches(
        { publicAccess: 0, updatedOn: new Date(2026, 8, 16, 0, 0, 0, 1) },
        range
      ).should.be.false;
    });

    it('should escape a text filter so it matches literally, ignoring case', function() {
      var match = publicTravelers.buildBaseMatch(
        baseParams({ textFilters: { subsystem: 'a.b(c)[d]*' } })
      );
      var condition = match.$and[3];
      condition.should.deep.equal({
        subsystem: { $regex: 'a\\.b\\(c\\)\\[d\\]\\*', $options: 'i' },
      });
      var doc = function(subsystem) {
        return { publicAccess: 0, subsystem: subsystem };
      };
      matches(doc('xx A.B(C)[D]* yy'), match).should.be.true;
      matches(doc('aXb(c)[d]*'), match).should.be.false;
    });

    it('should match partial text, ignoring case, for each of the six filters', function() {
      [
        'subsystem',
        'device',
        'activity',
        'machineArea',
        'sector',
        'windchillId',
      ].forEach(function(name) {
        var filters = {};
        filters[name] = 'cryo';
        var match = publicTravelers.buildBaseMatch(
          baseParams({ textFilters: filters })
        );
        var hit = { publicAccess: 0 };
        hit[name] = 'CRYO-2';
        var miss = { publicAccess: 0 };
        miss[name] = 'RF';
        matches(hit, match).should.be.true;
        matches(miss, match).should.be.false;
        matches({ publicAccess: 0 }, match).should.be.false;
      });
    });

    it('should treat .* as literal text, not a wildcard', function() {
      var match = publicTravelers.buildBaseMatch(
        baseParams({ textFilters: { device: '.*' } })
      );
      matches({ publicAccess: 0, device: 'CM-02' }, match).should.be.false;
      matches({ publicAccess: 0, device: 'a.*b' }, match).should.be.true;
    });

    it('should give each tag its own anchored condition, all required', function() {
      var match = publicTravelers.buildBaseMatch(
        baseParams({ tags: ['Leak-Check', 'vacuum'] })
      );
      match.$and
        .slice(3)
        .should.deep.equal([
          { tags: { $regex: '^Leak-Check$', $options: 'i' } },
          { tags: { $regex: '^vacuum$', $options: 'i' } },
        ]);
      var doc = function(tags) {
        return { publicAccess: 0, tags: tags };
      };
      matches(doc(['leak-check', 'VACUUM', 'other']), match).should.be.true;
      matches(doc(['leak-check']), match).should.be.false;
      matches(doc(['leak-checks', 'vacuum']), match).should.be.false;
      matches(doc([]), match).should.be.false;
      matches({ publicAccess: 0 }, match).should.be.false;
    });

    it('should escape a tag', function() {
      var match = publicTravelers.buildBaseMatch(baseParams({ tags: ['a.c'] }));
      matches({ publicAccess: 0, tags: ['abc'] }, match).should.be.false;
      matches({ publicAccess: 0, tags: ['a.c'] }, match).should.be.true;
    });

    it('should require every filter at once', function() {
      var match = publicTravelers.buildBaseMatch(
        baseParams({
          textFilters: { subsystem: 'cryo' },
          tags: ['vacuum'],
        })
      );
      matches(
        { publicAccess: 0, subsystem: 'Cryogenics', tags: ['vacuum'] },
        match
      ).should.be.true;
      matches({ publicAccess: 0, subsystem: 'RF', tags: ['vacuum'] }, match)
        .should.be.false;
      matches({ publicAccess: 0, subsystem: 'Cryogenics', tags: [] }, match)
        .should.be.false;
    });

    it('should never let a filter widen the public tier', function() {
      var match = publicTravelers.buildBaseMatch(
        baseParams({
          textFilters: { subsystem: 'cryo' },
          tags: ['vacuum'],
          updatedFrom: new Date(2020, 0, 1),
        })
      );
      match.$and[0].should.deep.equal(reqUtils.publicAccessMatch());
      matches(
        {
          publicAccess: -1,
          subsystem: 'cryo',
          tags: ['vacuum'],
          updatedOn: new Date(2026, 0, 1),
        },
        match
      ).should.be.false;
    });
  });

  describe('#buildStatusMatch', function() {
    it('should return null when no status is requested', function() {
      expect(publicTravelers.buildStatusMatch([])).to.equal(null);
      expect(publicTravelers.buildStatusMatch(undefined)).to.equal(null);
    });

    it('should match live statuses on non-archived travelers', function() {
      publicTravelers.buildStatusMatch([1, 2]).should.deep.equal({
        archived: { $ne: true },
        status: { $in: [1, 2] },
      });
    });

    it('should match initialized as any status that is not one of the others, including a missing one', function() {
      publicTravelers.buildStatusMatch([0]).should.deep.equal({
        archived: { $ne: true },
        status: { $nin: [1, 1.5, 2, 3, 4] },
      });
    });

    it('should match archived as the flag or status 4', function() {
      publicTravelers.buildStatusMatch([4]).should.deep.equal({
        $or: [{ archived: true }, { status: 4 }],
      });
    });

    it('should OR several parts together', function() {
      var match = publicTravelers.buildStatusMatch([4, 1, 0]);
      match.$or.length.should.equal(3);
      match.$or[0].status.should.deep.equal({ $in: [1] });
      match.$or[1].status.should.deep.equal({ $nin: [1, 1.5, 2, 3, 4] });
      match.$or[2].should.deep.equal({
        $or: [{ archived: true }, { status: 4 }],
      });
    });

    it('should select exactly the travelers effectiveStatus puts in that status', function() {
      var docs = [
        {},
        { status: null },
        { status: 0 },
        { status: 1 },
        { status: 1.5 },
        { status: 2 },
        { status: 3 },
        { status: 4 },
        { status: 7 },
        { status: 'x' },
        { archived: true },
        { archived: true, status: 2 },
        { archived: true, status: 0 },
        { archived: false, status: 2 },
        { archived: false, status: 4 },
      ];
      [0, 1, 1.5, 2, 3, 4].forEach(function(code) {
        var match = publicTravelers.buildStatusMatch([code]);
        docs.forEach(function(doc) {
          matches(doc, match).should.equal(
            publicTravelers.effectiveStatus(doc).code === code,
            'status ' + code + ' for ' + JSON.stringify(doc)
          );
        });
      });
    });

    it('should match a traveler in any of several requested statuses', function() {
      var match = publicTravelers.buildStatusMatch([1, 2]);
      matches({ status: 1 }, match).should.be.true;
      matches({ status: 2 }, match).should.be.true;
      matches({ status: 3 }, match).should.be.false;
      matches({ status: 2, archived: true }, match).should.be.false;
    });
  });

  describe('the items and counts pipelines with filters', function() {
    var params = {
      page: 1,
      limit: 25,
      paged: true,
      statuses: [1],
      includeArchived: false,
      textFilters: { subsystem: 'cryo' },
      tags: [],
    };

    it('should add the status match to the items pipeline only', function() {
      var items = publicTravelers.buildItemsPipeline(params)[0].$match;
      var counts = publicTravelers.buildCountsPipeline(params)[0].$match;
      items.$and.length.should.equal(counts.$and.length + 1);
      items.$and[items.$and.length - 1].should.deep.equal(
        publicTravelers.buildStatusMatch([1])
      );
      counts.should.deep.equal(publicTravelers.buildBaseMatch(params));
    });

    it('should apply the other filters to both pipelines', function() {
      var subsystem = { subsystem: { $regex: 'cryo', $options: 'i' } };
      publicTravelers
        .buildItemsPipeline(params)[0]
        .$match.$and.should.deep.include(subsystem);
      publicTravelers
        .buildCountsPipeline(params)[0]
        .$match.$and.should.deep.include(subsystem);
    });

    it('should include archived travelers in the counts when the status filter asks for them', function() {
      var asked = publicTravelers.parseListQuery({ status: 'archived' });
      var counts = publicTravelers.buildCountsPipeline(asked)[0].$match;
      counts.$and.should.not.deep.include({ archived: { $ne: true } });
      var items = publicTravelers.buildItemsPipeline(asked)[0].$match;
      items.$and.should.deep.include(publicTravelers.buildStatusMatch([4]));
    });
  });

  describe('#listHandler filters (real HTTP)', function() {
    var server;
    var port;
    var errorStub;

    function start(model) {
      var app = express();
      app.get('/list', publicTravelers.listHandler(model));
      return new Promise(function(resolve) {
        server = http.createServer(app).listen(0, '127.0.0.1', function() {
          port = server.address().port;
          resolve();
        });
      });
    }

    function get(path) {
      return new Promise(function(resolve, reject) {
        http
          .get({ host: '127.0.0.1', port: port, path: path }, function(res) {
            var chunks = [];
            res.on('data', function(chunk) {
              chunks.push(chunk);
            });
            res.on('end', function() {
              resolve({
                status: res.statusCode,
                text: Buffer.concat(chunks).toString('utf8'),
              });
            });
          })
          .on('error', reject);
      });
    }

    beforeEach(function() {
      errorStub = sinon.stub(require('../../lib/loggers').getLogger(), 'error');
    });

    afterEach(function() {
      errorStub.restore();
      return new Promise(function(resolve) {
        if (!server) {
          return resolve();
        }
        return server.close(resolve);
      });
    });

    it('should reject bracket parameters, which Express parses into objects', function() {
      var model = fakeModel([], []);
      var paths = [
        '/list?subsystem[$ne]=x',
        '/list?status[$gt]=1',
        '/list?tags[$ne]=a',
        '/list?updatedFrom[$gt]=1',
        '/list?includeArchived[$ne]=x',
        '/list?limit[$gt]=1',
      ];
      return start(model)
        .then(function() {
          return paths.reduce(function(chain, path) {
            return chain.then(function() {
              return get(path).then(function(res) {
                res.status.should.equal(400, path);
                JSON.parse(res.text).error.should.be.a('string');
              });
            });
          }, Promise.resolve());
        })
        .then(function() {
          model.calls.length.should.equal(0);
        });
    });

    it('should turn filter parameters into conditions in the database query', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get(
            '/list?subsystem=cryo&status=active&tags=vacuum&updatedFrom=2026-09-01'
          );
        })
        .then(function(res) {
          res.status.should.equal(200);
          var conditions = itemsCall(model).pipeline[0].$match.$and;
          conditions.should.deep.include({
            subsystem: { $regex: 'cryo', $options: 'i' },
          });
          conditions.should.deep.include({
            tags: { $regex: '^vacuum$', $options: 'i' },
          });
          conditions.should.deep.include(publicTravelers.buildStatusMatch([1]));
        });
    });

    it('should reject an unknown status with the accepted values in the message', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?status=done');
        })
        .then(function(res) {
          res.status.should.equal(400);
          JSON.parse(res.text).error.should.include('completed');
          model.calls.length.should.equal(0);
        });
    });

    it('should reject a start after the end', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?updatedFrom=2026-09-15&updatedTo=2026-09-01');
        })
        .then(function(res) {
          res.status.should.equal(400);
          model.calls.length.should.equal(0);
        });
    });
  });

  describe('#toCsv', function() {
    var HEADER =
      '_id,title,status,createdBy,createdOn,updatedBy,updatedOn,archivedOn,owner,tags,totalInput,finishedInput,subsystem,device,activity,machineArea,sector,windchillId';

    // a small RFC 4180 reader, so tests can check what a spreadsheet would see
    function parseCsv(text) {
      var rows = [];
      var row = [];
      var cell = '';
      var quoted = false;
      for (var i = 0; i < text.length; i += 1) {
        var ch = text.charAt(i);
        if (quoted) {
          if (ch === '"' && text.charAt(i + 1) === '"') {
            cell += '"';
            i += 1;
          } else if (ch === '"') {
            quoted = false;
          } else {
            cell += ch;
          }
        } else if (ch === '"') {
          quoted = true;
        } else if (ch === ',') {
          row.push(cell);
          cell = '';
        } else if (ch === '\n') {
          row.push(cell);
          rows.push(row);
          row = [];
          cell = '';
        } else {
          cell += ch;
        }
      }
      row.push(cell);
      rows.push(row);
      return rows;
    }

    function record(over) {
      return Object.assign(publicTravelers.toRecord({}), over);
    }

    it('should name the columns in the documented order', function() {
      publicTravelers.CSV_COLUMNS.join(',').should.equal(HEADER);
    });

    it('should use the JSON keys, without statusCode', function() {
      var keys = Object.keys(publicTravelers.toRecord({})).filter(function(k) {
        return k !== 'statusCode';
      });
      publicTravelers.CSV_COLUMNS.should.deep.equal(keys);
    });

    it('should give only the header row when there are no records', function() {
      publicTravelers.toCsv([]).should.equal(HEADER);
    });

    it('should write one row per record, in order, with no trailing newline', function() {
      var text = publicTravelers.toCsv([
        record({ title: 'first' }),
        record({ title: 'second' }),
      ]);
      var rows = parseCsv(text);
      rows.length.should.equal(3);
      rows[0].join(',').should.equal(HEADER);
      rows[1][1].should.equal('first');
      rows[2][1].should.equal('second');
      text.slice(-1).should.not.equal('\n');
    });

    it('should write a full record exactly as documented', function() {
      var line = publicTravelers
        .toCsv([
          record({
            _id: '64f1a2b3c4d5e6f7a8b9c0d1',
            title: 'Cryomodule leak check',
            status: 'active',
            statusCode: 1,
            createdBy: 'liud',
            createdOn: new Date('2026-08-30T14:02:11.000Z'),
            updatedBy: 'smith',
            updatedOn: new Date('2026-09-14T09:41:03.000Z'),
            owner: 'liud',
            tags: ['leak-check', 'vacuum'],
            totalInput: 36,
            finishedInput: 12,
            subsystem: 'Cryogenics',
            device: 'CM-02',
            activity: 'Acceptance test',
            machineArea: 'Linac tunnel',
            sector: 'S4',
            windchillId: 'WC-0012345',
          }),
        ])
        .split('\n')[1];
      line.should.equal(
        '64f1a2b3c4d5e6f7a8b9c0d1,Cryomodule leak check,active,liud,2026-08-30T14:02:11.000Z,smith,2026-09-14T09:41:03.000Z,,liud,leak-check;vacuum,36,12,Cryogenics,CM-02,Acceptance test,Linac tunnel,S4,WC-0012345'
      );
    });

    it('should leave a missing value as an empty cell, and write a zero as 0', function() {
      var cells = parseCsv(publicTravelers.toCsv([record({})]))[1];
      cells.length.should.equal(18);
      cells[4].should.equal('');
      cells[6].should.equal('');
      cells[7].should.equal('');
      cells[9].should.equal('');
      cells[10].should.equal('0');
      cells[11].should.equal('0');
    });

    it('should write dates as ISO 8601 UTC', function() {
      var cells = parseCsv(
        publicTravelers.toCsv([
          record({ createdOn: new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)) }),
        ])
      )[1];
      cells[4].should.equal('2026-01-02T03:04:05.006Z');
    });

    it('should join tags with semicolons in one cell', function() {
      var cells = parseCsv(
        publicTravelers.toCsv([record({ tags: ['a', 'b, c', 'd'] })])
      )[1];
      cells.length.should.equal(18);
      cells[9].should.equal('a;b, c;d');
    });

    it('should keep a comma, a quote, and a line break in one cell, as entered', function() {
      var title = 'say "hi", then\nleave';
      var rows = parseCsv(publicTravelers.toCsv([record({ title: title })]));
      rows.length.should.equal(2);
      rows[1].length.should.equal(18);
      rows[1][1].should.equal(title);
    });

    it('should keep international characters intact', function() {
      var title = 'Kühlung – 冷却 ✓ café';
      var text = publicTravelers.toCsv([record({ title: title })]);
      parseCsv(text)[1][1].should.equal(title);
      Buffer.from(text, 'utf8')
        .toString('utf8')
        .should.equal(text);
    });

    it('should show text that starts a formula as text', function() {
      var rows = parseCsv(
        publicTravelers.toCsv([
          record({
            title: '=SUM(A1), "draft"',
            owner: '@user',
            subsystem: '-1+2',
            device: '+cmd',
            tags: ['=1+1', 'ok'],
          }),
        ])
      );
      rows[1][1].should.equal('\'=SUM(A1), "draft"');
      rows[1][8].should.equal("'@user");
      rows[1][12].should.equal("'-1+2");
      rows[1][13].should.equal("'+cmd");
      rows[1][9].should.equal("'=1+1;ok");
    });

    it('should not alter text that only contains a formula character', function() {
      var cells = parseCsv(
        publicTravelers.toCsv([record({ title: 'a=b', owner: 'x-y' })])
      )[1];
      cells[1].should.equal('a=b');
      cells[8].should.equal('x-y');
    });

    it('should write an identifier object as its text', function() {
      var id = {
        toString: function() {
          return '64f1a2b3c4d5e6f7a8b9c0d1';
        },
      };
      parseCsv(publicTravelers.toCsv([record({ _id: id })]))[1][0].should.equal(
        '64f1a2b3c4d5e6f7a8b9c0d1'
      );
    });

    it('should start with a byte order mark only when asked', function() {
      var records = [record({ title: 'x' })];
      var plain = publicTravelers.toCsv(records);
      var marked = publicTravelers.toCsv(records, { bom: true });
      plain.charAt(0).should.equal('_');
      marked.charAt(0).should.equal('﻿');
      marked.slice(1).should.equal(plain);
      publicTravelers.toCsv(records, { bom: false }).should.equal(plain);
      publicTravelers.toCsv(records, {}).should.equal(plain);
    });

    it('should not change the records it is given', function() {
      var original = record({ title: '=1', tags: ['a', 'b'] });
      var copy = JSON.parse(JSON.stringify(original));
      publicTravelers.toCsv([original]);
      JSON.parse(JSON.stringify(original)).should.deep.equal(copy);
    });
  });

  describe('#parseListQuery format', function() {
    it('should default to json and read csv in any case', function() {
      publicTravelers.parseListQuery({}).format.should.equal('json');
      publicTravelers
        .parseListQuery({ format: '' })
        .format.should.equal('json');
      publicTravelers
        .parseListQuery({ format: 'json' })
        .format.should.equal('json');
      publicTravelers
        .parseListQuery({ format: 'CSV' })
        .format.should.equal('csv');
      publicTravelers
        .parseListQuery({ format: ' csv ' })
        .format.should.equal('csv');
    });

    it('should reject any other format, and a non-text value', function() {
      ['xml', 'xls', 'csv,json', 'text/csv'].forEach(function(format) {
        expect(function() {
          publicTravelers.parseListQuery({ format: format });
        }).to.throw('format must be json or csv');
      });
      expect(function() {
        publicTravelers.parseListQuery({ format: { $ne: 'x' } });
      }).to.throw(/format/);
    });

    it('should still report whether the caller asked for paging', function() {
      publicTravelers.parseListQuery({ format: 'csv' }).paged.should.be.false;
      publicTravelers.parseListQuery({ format: 'csv', limit: '5' }).paged.should
        .be.true;
      publicTravelers.parseListQuery({ format: 'csv', page: '2' }).paged.should
        .be.true;
    });
  });

  describe('#listHandler CSV output (real HTTP)', function() {
    var HEADER =
      '_id,title,status,createdBy,createdOn,updatedBy,updatedOn,archivedOn,owner,tags,totalInput,finishedInput,subsystem,device,activity,machineArea,sector,windchillId';
    var server;
    var port;
    var errorStub;

    function start(model, options) {
      var app = express();
      app.get('/list', publicTravelers.listHandler(model, options));
      return new Promise(function(resolve) {
        server = http.createServer(app).listen(0, '127.0.0.1', function() {
          port = server.address().port;
          resolve();
        });
      });
    }

    function get(path) {
      return new Promise(function(resolve, reject) {
        http
          .get({ host: '127.0.0.1', port: port, path: path }, function(res) {
            var chunks = [];
            res.on('data', function(chunk) {
              chunks.push(chunk);
            });
            res.on('end', function() {
              var buffer = Buffer.concat(chunks);
              resolve({
                status: res.statusCode,
                headers: res.headers,
                bytes: buffer,
                text: buffer.toString('utf8'),
              });
            });
          })
          .on('error', reject);
      });
    }

    var ROWS = [
      { _id: 'a', title: 'A', status: 1, createdBy: 'liud' },
      { _id: 'b', title: '=SUM(A1), "draft"', status: 2 },
      { _id: 'c', title: 'Kühlung', status: 0 },
    ];

    beforeEach(function() {
      errorStub = sinon.stub(require('../../lib/loggers').getLogger(), 'error');
    });

    afterEach(function() {
      errorStub.restore();
      return new Promise(function(resolve) {
        if (!server) {
          return resolve();
        }
        return server.close(resolve);
      });
    });

    it('should answer format=csv with a CSV attachment', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          res.status.should.equal(200);
          res.headers['content-type'].should.equal('text/csv; charset=utf-8');
          res.headers['content-disposition'].should.match(
            /^attachment; filename="public-travelers-\d{8}\.csv"$/
          );
          var lines = res.text.split('\n');
          lines[0].should.equal(HEADER);
          lines[1].should.match(/^a,A,active,liud,,,,,liud,,0,0,/);
        });
    });

    it('should name the file after the date of the request, in UTC', function() {
      var model = fakeModel([], []);
      var stamp = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
      return start(model)
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          res.headers['content-disposition'].should.include(
            'public-travelers-' + stamp + '.csv'
          );
        });
    });

    it('should return every match when neither page nor limit is given', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          res.text.split('\n').length.should.equal(4);
          var stages = itemsCall(model).pipeline.map(function(stage) {
            return Object.keys(stage)[0];
          });
          stages.should.deep.equal(['$match', '$project', '$sort']);
        });
    });

    it('should return only the requested page when limit or page is given', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list?format=csv&limit=2');
        })
        .then(function() {
          itemsCall(model).pipeline.should.deep.include({ $limit: 2 });
          itemsCall(model).pipeline.should.not.deep.include({ $skip: 2 });
          model.calls.length = 0;
          return get('/list?format=csv&page=3');
        })
        .then(function() {
          itemsCall(model).pipeline.should.deep.include({ $skip: 50 });
          itemsCall(model).pipeline.should.deep.include({ $limit: 25 });
        });
    });

    it('should give only the header row when nothing matches', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?format=csv&subsystem=nomatch');
        })
        .then(function(res) {
          res.status.should.equal(200);
          res.text.should.equal(HEADER);
        });
    });

    it('should apply the same filters as the JSON output', function() {
      var model = fakeModel([], []);
      return start(model)
        .then(function() {
          return get('/list?format=csv&subsystem=cryo&status=active');
        })
        .then(function() {
          var conditions = itemsCall(model).pipeline[0].$match.$and;
          conditions.should.deep.include({
            subsystem: { $regex: 'cryo', $options: 'i' },
          });
          conditions.should.deep.include(publicTravelers.buildStatusMatch([1]));
        });
    });

    it('should show a formula in a title as text, and keep international text', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          res.text.should.include('b,"\'=SUM(A1), ""draft"""');
          res.text.should.include('Kühlung');
        });
    });

    it('should not start with a byte order mark by default', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          res.bytes[0].should.equal('_'.charCodeAt(0));
        });
    });

    it('should start with a UTF-8 byte order mark when created with bom: true', function() {
      var model = fakeModel(ROWS, []);
      return start(model, { bom: true })
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          Array.prototype.slice
            .call(res.bytes, 0, 3)
            .should.deep.equal([0xef, 0xbb, 0xbf]);
          res.bytes
            .slice(3)
            .toString('utf8')
            .split('\n')[0]
            .should.equal(HEADER);
        });
    });

    it('should give the same rows with and without the byte order mark', function() {
      var plainModel = fakeModel(ROWS, []);
      var markedModel = fakeModel(ROWS, []);
      var plainText;
      return start(plainModel)
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          plainText = res.text;
          return new Promise(function(resolve) {
            server.close(resolve);
          });
        })
        .then(function() {
          return start(markedModel, { bom: true });
        })
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          res.bytes
            .slice(3)
            .toString('utf8')
            .should.equal(plainText);
        });
    });

    it('should accept the format in any case, and give JSON for format=json or a blank format', function() {
      var model = fakeModel(ROWS, [{ _id: 1, n: 1 }]);
      return start(model)
        .then(function() {
          return get('/list?format=CSV');
        })
        .then(function(res) {
          res.headers['content-type'].should.include('text/csv');
          return get('/list?format=json');
        })
        .then(function(res) {
          res.headers['content-type'].should.include('application/json');
          should.not.exist(res.headers['content-disposition']);
          return get('/list?format=');
        })
        .then(function(res) {
          res.headers['content-type'].should.include('application/json');
        });
    });

    it('should page JSON by default even though CSV does not', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list');
        })
        .then(function() {
          itemsCall(model).pipeline.should.deep.include({ $limit: 25 });
        });
    });

    it('should reject format=xml with a JSON error and no database call', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list?format=xml');
        })
        .then(function(res) {
          res.status.should.equal(400);
          res.headers['content-type'].should.include('application/json');
          JSON.parse(res.text).should.deep.equal({
            error: 'format must be json or csv',
          });
          model.calls.length.should.equal(0);
        });
    });

    it('should keep errors as JSON when a CSV was asked for', function() {
      var model = fakeModel(ROWS, []);
      return start(model)
        .then(function() {
          return get('/list?format=csv&limit=0');
        })
        .then(function(res) {
          res.status.should.equal(400);
          res.headers['content-type'].should.include('application/json');
          should.not.exist(res.headers['content-disposition']);
          JSON.parse(res.text).error.should.include('limit');
        });
    });

    it('should answer 500 with a JSON generic message when the database fails', function() {
      var model = fakeModel([], [], new Error('secret'));
      return start(model)
        .then(function() {
          return get('/list?format=csv');
        })
        .then(function(res) {
          res.status.should.equal(500);
          res.headers['content-type'].should.include('application/json');
          JSON.parse(res.text).should.deep.equal({ error: 'internal error' });
          res.text.should.not.include('secret');
        });
    });
  });

  describe('null characters', function() {
    function rejects(fn) {
      var thrown;
      try {
        fn();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.an('error');
      thrown.status.should.equal(400);
      return thrown;
    }

    it('should reject a null character in a single text value, naming the parameter', function() {
      var thrown = rejects(function() {
        publicTravelers.readString({ subsystem: 'a\u0000b' }, 'subsystem');
      });
      thrown.message.should.equal(
        'subsystem must not contain a null character'
      );
    });

    it('should reject a null character in a list, in a string or in any element', function() {
      rejects(function() {
        publicTravelers.readList({ tags: 'a,\u0000' }, 'tags');
      }).message.should.include('tags must not contain a null character');
      rejects(function() {
        publicTravelers.readList({ tags: ['ok', 'x\u0000y'] }, 'tags');
      });
    });

    it('should reject it in every parameter, so none can reach the database', function() {
      [
        'page',
        'limit',
        'format',
        'updatedFrom',
        'updatedTo',
        'subsystem',
        'device',
        'activity',
        'machineArea',
        'sector',
        'windchillId',
        'tags',
        'status',
        'includeArchived',
      ].forEach(function(name) {
        var query = {};
        query[name] = '1\u0000';
        rejects(function() {
          publicTravelers.parseListQuery(query);
        }).message.should.include(name);
      });
    });

    it('should still accept other control characters and unusual text', function() {
      var params = publicTravelers.parseListQuery({
        subsystem: 'a\tb',
        device: 'café 冷却 😀',
        activity: '￿',
      });
      params.textFilters.subsystem.should.equal('a\tb');
      params.textFilters.device.should.include('冷却');
    });

    it('should answer 400 with a JSON error, and not touch the database, over real HTTP', function() {
      var model = fakeModel([], []);
      var server;
      var port;
      var app = express();
      app.get('/list', publicTravelers.listHandler(model));
      function get(path) {
        return new Promise(function(resolve, reject) {
          http
            .get({ host: '127.0.0.1', port: port, path: path }, function(res) {
              var chunks = [];
              res.on('data', function(chunk) {
                chunks.push(chunk);
              });
              res.on('end', function() {
                resolve({
                  status: res.statusCode,
                  text: Buffer.concat(chunks).toString('utf8'),
                });
              });
            })
            .on('error', reject);
        });
      }
      var paths = [
        '/list?subsystem=%00',
        '/list?subsystem=a%00b',
        '/list?tags=x%00',
        '/list?status=%00',
        '/list?format=csv&device=%00',
      ];
      return new Promise(function(resolve) {
        server = http.createServer(app).listen(0, '127.0.0.1', function() {
          port = server.address().port;
          resolve();
        });
      })
        .then(function() {
          return paths.reduce(function(chain, path) {
            return chain.then(function() {
              return get(path).then(function(res) {
                res.status.should.equal(400, path);
                JSON.parse(res.text).error.should.include(
                  'must not contain a null character'
                );
              });
            });
          }, Promise.resolve());
        })
        .then(function() {
          model.calls.length.should.equal(0);
          return new Promise(function(resolve) {
            server.close(resolve);
          });
        });
    });
  });

  describe('the individual traveler export, from a Mongoose document', function() {
    var Traveler = require('../../model/traveler').Traveler;
    var csvLib = require('../../lib/csv');
    var URL = 'https://traveler.example.org/travelers/abc/view';

    function exportOf(fields, fieldsRows) {
      var doc = new Traveler(fields);
      var output = csvLib.buildTravelerCsv({
        record: publicTravelers.toRecord(doc),
        url: URL,
        fields: fieldsRows || [],
      });
      return { doc: doc, lines: output.split('\n'), output: output };
    }

    it('should write the header and one metadata row from a real document', function() {
      var made = exportOf({
        title: 'Pump Assembly',
        status: 2,
        createdBy: 'liud',
        createdOn: new Date('2026-08-30T14:02:11.000Z'),
        updatedBy: 'smith',
        updatedOn: new Date('2026-09-14T09:41:03.000Z'),
        tags: ['torque', 'pump'],
        totalInput: 36,
        finishedInput: 12,
        subsystem: 'Cryogenics',
        device: 'CM-02',
        activity: 'Acceptance test',
        machineArea: 'Linac tunnel',
        sector: 'S4',
        windchillId: 'WC-0012345',
      });
      made.lines[0].should.equal(csvLib.TRAVELER_COLUMNS.join(','));
      made.lines[1].should.equal(
        made.doc.id +
          ',' +
          URL +
          ',Pump Assembly,completed,liud,2026-08-30T14:02:11.000Z,smith,2026-09-14T09:41:03.000Z,,liud,torque;pump,36,12,Cryogenics,CM-02,Acceptance test,Linac tunnel,S4,WC-0012345'
      );
    });

    it('should write the identifier as the 24-character text of the id', function() {
      var made = exportOf({ title: 'x' });
      made.lines[1].split(',')[0].should.match(/^[0-9a-f]{24}$/);
      made.lines[1].split(',')[0].should.equal(String(made.doc._id));
    });

    it('should write the status by name for every status, and initialized when none was set', function() {
      [
        [0, 'initialized'],
        [1, 'active'],
        [1.5, 'submitted for completion'],
        [2, 'completed'],
        [3, 'frozen'],
        [4, 'archived'],
      ].forEach(function(pair) {
        exportOf({ title: 't', status: pair[0] })
          .lines[1].split(',')[3]
          .should.equal(pair[1]);
      });
      exportOf({ title: 't' })
        .lines[1].split(',')[3]
        .should.equal('initialized');
    });

    it('should write an archived traveler as archived, with its archive date', function() {
      var made = exportOf({
        title: 't',
        status: 2,
        archived: true,
        archivedOn: new Date('2026-09-20T01:02:03.004Z'),
      });
      var cells = made.lines[1].split(',');
      cells[3].should.equal('archived');
      cells[8].should.equal('2026-09-20T01:02:03.004Z');
    });

    it('should leave out a stale archive date once a traveler is restored', function() {
      var cells = exportOf({
        title: 't',
        status: 1,
        archived: false,
        archivedOn: new Date('2026-01-01T00:00:00.000Z'),
      }).lines[1].split(',');
      cells[3].should.equal('active');
      cells[8].should.equal('');
    });

    it('should use the creator as the owner when there is none, and the owner when there is one', function() {
      exportOf({ title: 't', createdBy: 'liud' })
        .lines[1].split(',')[9]
        .should.equal('liud');
      exportOf({ title: 't', createdBy: 'liud', owner: 'smith' })
        .lines[1].split(',')[9]
        .should.equal('smith');
    });

    it('should show text that starts a formula as text, from a real document', function() {
      var made = exportOf({
        title: '=SUM(A1), "draft"',
        tags: ['@x', 'ok'],
      });
      made.output.should.include('"\'=SUM(A1), ""draft"""');
      made.output.should.include("'@x;ok");
    });

    it('should keep the data section after the metadata section', function() {
      var made = exportOf({ title: 't' }, [
        {
          name: 'torque',
          label: 'Torque',
          type: 'number',
          value: 42,
          inputBy: 'jdoe',
          inputOn: 1787234591,
        },
      ]);
      made.lines[2].should.equal('');
      made.lines[3].should.equal(
        'Field Name,Label,Type,Value,Input By,Input On'
      );
      made.lines[4].should.equal('torque,Torque,number,42,jdoe,1787234591');
    });
  });

  describe('the device, with the older devices list', function() {
    var Traveler = require('../../model/traveler').Traveler;
    var csvLib = require('../../lib/csv');
    var DEVICE_CELL = csvLib.TRAVELER_COLUMNS.indexOf('device');

    it("should report the traveler's own device", function() {
      publicTravelers
        .toRecord({ device: 'CM-02' })
        .device.should.equal('CM-02');
    });

    it('should fall back to the older list, joined with a slash', function() {
      publicTravelers
        .toRecord({ devices: ['DEV-1', 'DEV-2'] })
        .device.should.equal('DEV-1/DEV-2');
      publicTravelers
        .toRecord({ devices: ['DEV-1'] })
        .device.should.equal('DEV-1');
    });

    it("should prefer the traveler's own device when there is also a list", function() {
      publicTravelers
        .toRecord({ device: 'CM-02', devices: ['DEV-1'] })
        .device.should.equal('CM-02');
    });

    it('should fall back when the own device is blank', function() {
      publicTravelers
        .toRecord({ device: '', devices: ['DEV-1'] })
        .device.should.equal('DEV-1');
      publicTravelers
        .toRecord({ device: null, devices: ['DEV-1'] })
        .device.should.equal('DEV-1');
    });

    it('should leave the device empty when there is neither', function() {
      publicTravelers.toRecord({}).device.should.equal('');
      publicTravelers.toRecord({ devices: [] }).device.should.equal('');
      publicTravelers.toRecord({ devices: 'DEV-1' }).device.should.equal('');
      publicTravelers.toRecord({ devices: null }).device.should.equal('');
    });

    it('should drop blank and non-text names from the list', function() {
      publicTravelers
        .toRecord({ devices: ['', 'DEV-1', null, 5, 'DEV-2'] })
        .device.should.equal('DEV-1/DEV-2');
      publicTravelers.toRecord({ devices: ['', ''] }).device.should.equal('');
    });

    it('should not put the older list in the record', function() {
      publicTravelers
        .toRecord({ devices: ['DEV-1'] })
        .should.not.have.property('devices');
    });

    it('should read the older list from the database', function() {
      publicTravelers.RECORD_FIELDS.should.include('devices');
      publicTravelers.RECORD_FIELDS.should.include('device');
    });

    it('should show it in the list export and the traveler export', function() {
      var doc = new Traveler({ title: 't', devices: ['DEV-1', 'DEV-2'] });
      var record = publicTravelers.toRecord(doc);
      publicTravelers
        .toCsv([record])
        .split('\n')[1]
        .should.include(',DEV-1/DEV-2,');
      var single = csvLib
        .buildTravelerCsv({ record: record, url: 'u', fields: [] })
        .split('\n')[1]
        .split(',');
      single[DEVICE_CELL].should.equal('DEV-1/DEV-2');
    });

    it('should show its own device in the exports when the document has both', function() {
      var doc = new Traveler({
        title: 't',
        device: 'CM-02',
        devices: ['DEV-1'],
      });
      var single = csvLib
        .buildTravelerCsv({
          record: publicTravelers.toRecord(doc),
          url: 'u',
          fields: [],
        })
        .split('\n')[1]
        .split(',');
      single[DEVICE_CELL].should.equal('CM-02');
    });

    describe('the device filter', function() {
      function filterMatch(text) {
        return publicTravelers.buildBaseMatch({
          includeArchived: true,
          textFilters: { device: text },
        });
      }
      function traveler(over) {
        return Object.assign({ publicAccess: 0 }, over);
      }

      it('should look in the device, or in the older list when there is no device', function() {
        var condition = filterMatch('dev').$and[1];
        condition.should.deep.equal({
          $or: [
            { device: { $regex: 'dev', $options: 'i' } },
            {
              device: { $in: [null, ''] },
              devices: { $regex: 'dev', $options: 'i' },
            },
          ],
        });
      });

      it('should find a traveler by its own device, ignoring case', function() {
        matches(traveler({ device: 'CM-02' }), filterMatch('cm-0')).should.be
          .true;
        matches(traveler({ device: 'RF-1' }), filterMatch('cm-0')).should.be
          .false;
      });

      it('should find a traveler that has only the older list, by any of its devices', function() {
        var legacy = traveler({ devices: ['DEV-1', 'Pump-7'] });
        matches(legacy, filterMatch('dev-1')).should.be.true;
        matches(legacy, filterMatch('PUMP')).should.be.true;
        matches(legacy, filterMatch('zzz')).should.be.false;
      });

      it('should find a traveler whose own device is blank or null through the older list', function() {
        matches(
          traveler({ device: '', devices: ['DEV-1'] }),
          filterMatch('dev')
        ).should.be.true;
        matches(
          traveler({ device: null, devices: ['DEV-1'] }),
          filterMatch('dev')
        ).should.be.true;
      });

      it('should not look in the older list when the traveler has its own device, since that is not what is shown', function() {
        var both = traveler({ device: 'CM-02', devices: ['DEV-1'] });
        matches(both, filterMatch('dev-1')).should.be.false;
        matches(both, filterMatch('cm-02')).should.be.true;
      });

      it('should not match a traveler with no device at all', function() {
        matches(traveler({}), filterMatch('dev')).should.be.false;
        matches(traveler({ devices: [] }), filterMatch('dev')).should.be.false;
      });

      it('should take the text literally', function() {
        matches(traveler({ devices: ['DEV-1'] }), filterMatch('.*')).should.be
          .false;
        matches(traveler({ devices: ['a.*b'] }), filterMatch('.*')).should.be
          .true;
      });

      it('should leave the other text filters as they were', function() {
        var match = publicTravelers.buildBaseMatch({
          includeArchived: true,
          textFilters: { subsystem: 'cryo' },
        });
        match.$and[1].should.deep.equal({
          subsystem: { $regex: 'cryo', $options: 'i' },
        });
      });
    });
  });
});
