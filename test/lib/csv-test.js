var csv = require('../../lib/csv');
require('chai').should();

describe('csv', function() {
  describe('#escapeCsvValue', function() {
    it('should return an empty string for null or undefined', function() {
      csv.escapeCsvValue(null).should.equal('');
      csv.escapeCsvValue(undefined).should.equal('');
    });

    it('should return a plain value unchanged', function() {
      csv.escapeCsvValue('hello').should.equal('hello');
      csv.escapeCsvValue(42).should.equal('42');
    });

    it('should quote and double embedded quotes when value has a comma', function() {
      csv.escapeCsvValue('a,b').should.equal('"a,b"');
    });

    it('should quote and double embedded quotes when value has a quote', function() {
      csv.escapeCsvValue('say "hi"').should.equal('"say ""hi"""');
    });

    it('should quote when value has an embedded line break', function() {
      csv.escapeCsvValue('line1\nline2').should.equal('"line1\nline2"');
    });
  });

  describe('#toCsvRow', function() {
    it('should join escaped values with commas', function() {
      csv.toCsvRow(['a', 'b,c', 'd"e']).should.equal('a,"b,c","d""e"');
    });
  });

  describe('#toUnixTimestamp', function() {
    it('should return an empty string for a falsy date', function() {
      csv.toUnixTimestamp(null).should.equal('');
      csv.toUnixTimestamp(undefined).should.equal('');
      csv.toUnixTimestamp('').should.equal('');
    });

    it('should convert a Date to whole seconds since epoch', function() {
      csv.toUnixTimestamp(new Date('2026-01-02')).should.equal(1767312000);
    });

    it('should convert a date string the same way as a Date object', function() {
      csv.toUnixTimestamp('2026-01-02').should.equal(1767312000);
    });
  });

  describe('#resolveTravelerFields', function() {
    it('should return a single row for a field answered once', function() {
      var labels = { torque: 'Torque Reading' };
      var types = { torque: 'number' };
      var data = [
        {
          name: 'torque',
          value: 42,
          inputBy: 'jdoe',
          inputOn: new Date('2026-01-02'),
        },
      ];
      var fields = csv.resolveTravelerFields(labels, types, data);
      fields.should.have.lengthOf(1);
      fields[0].name.should.equal('torque');
      fields[0].label.should.equal('Torque Reading');
      fields[0].type.should.equal('number');
      fields[0].value.should.equal(42);
      fields[0].inputBy.should.equal('jdoe');
      fields[0].inputOn.should.equal(1767312000);
    });

    it('should return one row per submitted value when a field was answered more than once, oldest first', function() {
      var labels = { torque: 'Torque Reading' };
      var types = { torque: 'number' };
      var data = [
        {
          name: 'torque',
          value: 42,
          inputBy: 'jdoe',
          inputOn: new Date('2026-01-02'),
        },
        {
          name: 'torque',
          value: 40,
          inputBy: 'jdoe',
          inputOn: new Date('2026-01-01'),
        },
        {
          name: 'torque',
          value: 44,
          inputBy: 'asmith',
          inputOn: new Date('2026-01-03'),
        },
      ];
      var fields = csv.resolveTravelerFields(labels, types, data);
      fields.should.have.lengthOf(3);
      fields
        .map(function(f) {
          return f.value;
        })
        .should.deep.equal([40, 42, 44]);
      fields
        .map(function(f) {
          return f.inputBy;
        })
        .should.deep.equal(['jdoe', 'jdoe', 'asmith']);
      fields.forEach(function(f) {
        f.name.should.equal('torque');
        f.label.should.equal('Torque Reading');
      });
    });

    it('should return an empty row for a field with no submitted value', function() {
      var labels = { notes: 'Inspector Notes' };
      var types = { notes: 'textarea' };
      var fields = csv.resolveTravelerFields(labels, types, []);
      fields.should.have.lengthOf(1);
      fields[0].name.should.equal('notes');
      fields[0].label.should.equal('Inspector Notes');
      fields[0].value.should.equal('');
      fields[0].inputBy.should.equal('');
      fields[0].inputOn.should.equal('');
    });

    it('should return one row per label key in insertion order', function() {
      var labels = { first: 'First', second: 'Second' };
      var types = { first: 'text', second: 'text' };
      var fields = csv.resolveTravelerFields(labels, types, []);
      fields
        .map(function(f) {
          return f.name;
        })
        .should.deep.equal(['first', 'second']);
    });

    it("should give each field's label exactly what labels[name] holds", function() {
      var labels = {
        torque: 'Torque Reading (Nm)',
        inspector: 'Inspector Notes',
      };
      var types = { torque: 'number', inspector: 'textarea' };
      var fields = csv.resolveTravelerFields(labels, types, []);
      var byName = {};
      fields.forEach(function(f) {
        byName[f.name] = f.label;
      });
      byName.torque.should.equal('Torque Reading (Nm)');
      byName.inspector.should.equal('Inspector Notes');
    });

    it('should turn a file field value into a download link', function() {
      var labels = { photo: 'Photo' };
      var types = { photo: 'file' };
      var data = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'photo',
          value: 'inspection.jpg',
          inputBy: 'jdoe',
          inputOn: new Date('2026-01-02'),
        },
      ];
      var fields = csv.resolveTravelerFields(
        labels,
        types,
        data,
        'https://traveler.example.org'
      );
      fields[0].value.should.equal(
        'https://traveler.example.org/data/507f1f77bcf86cd799439011'
      );
    });

    it('should give each re-submitted file a link to its own download', function() {
      var labels = { photo: 'Photo' };
      var types = { photo: 'file' };
      var data = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'photo',
          value: 'first.jpg',
          inputBy: 'jdoe',
          inputOn: new Date('2026-01-01'),
        },
        {
          _id: '507f1f77bcf86cd799439022',
          name: 'photo',
          value: 'second.jpg',
          inputBy: 'jdoe',
          inputOn: new Date('2026-01-02'),
        },
      ];
      var fields = csv.resolveTravelerFields(
        labels,
        types,
        data,
        'https://traveler.example.org'
      );
      fields.should.have.lengthOf(2);
      fields[0].value.should.equal(
        'https://traveler.example.org/data/507f1f77bcf86cd799439011'
      );
      fields[1].value.should.equal(
        'https://traveler.example.org/data/507f1f77bcf86cd799439022'
      );
    });

    it('should leave an unanswered file field empty (no link)', function() {
      var labels = { photo: 'Photo' };
      var types = { photo: 'file' };
      var fields = csv.resolveTravelerFields(
        labels,
        types,
        [],
        'https://traveler.example.org'
      );
      fields[0].value.should.equal('');
    });
  });

  describe('#buildTravelerCsv', function() {
    var HEADER =
      '_id,url,title,status,createdBy,createdOn,updatedBy,updatedOn,archivedOn,owner,tags,totalInput,finishedInput,subsystem,device,activity,machineArea,sector,windchillId';
    var DATA_HEADER = 'Field Name,Label,Type,Value,Input By,Input On';
    var URL = 'https://traveler.example.org/travelers/abc123/view';
    var FIELDS = [
      {
        name: 'torque',
        label: 'Torque Reading',
        type: 'number',
        value: 42,
        inputBy: 'jdoe',
        inputOn: 1787234591,
      },
      {
        name: 'notes',
        label: 'Inspector Notes',
        type: 'textarea',
        value: '',
        inputBy: '',
        inputOn: '',
      },
    ];

    function record(over) {
      return Object.assign(
        {
          _id: 'abc123',
          title: 'Pump Assembly Torque Check',
          status: 'active',
          createdBy: 'jdoe',
          createdOn: new Date('2026-08-30T14:02:11.000Z'),
          updatedBy: 'smith',
          updatedOn: new Date('2026-09-14T09:41:03.000Z'),
          archivedOn: null,
          owner: 'jdoe',
          tags: ['torque', 'pump'],
          totalInput: 36,
          finishedInput: 12,
          subsystem: 'Cryogenics',
          device: 'CM-02',
          activity: 'Acceptance test',
          machineArea: 'Linac tunnel',
          sector: 'S4',
          windchillId: 'WC-0012345',
        },
        over
      );
    }

    it('should name the metadata columns in the documented order, with url after _id', function() {
      csv.TRAVELER_COLUMNS.join(',').should.equal(HEADER);
      csv.TRAVELER_COLUMNS[0].should.equal('_id');
      csv.TRAVELER_COLUMNS[1].should.equal('url');
      csv.TRAVELER_COLUMNS.should.have.lengthOf(19);
    });

    it('should write the metadata header and row, a blank separator, the data header, and the data rows', function() {
      var output = csv.buildTravelerCsv({
        record: record(),
        url: URL,
        fields: FIELDS,
      });
      var lines = output.split('\n');
      lines[0].should.equal(HEADER);
      lines[1].should.equal(
        'abc123,https://traveler.example.org/travelers/abc123/view,Pump Assembly Torque Check,active,jdoe,2026-08-30T14:02:11.000Z,smith,2026-09-14T09:41:03.000Z,,jdoe,torque;pump,36,12,Cryogenics,CM-02,Acceptance test,Linac tunnel,S4,WC-0012345'
      );
      lines[2].should.equal('');
      lines[3].should.equal(DATA_HEADER);
      lines[4].should.equal('torque,Torque Reading,number,42,jdoe,1787234591');
      lines[5].should.equal('notes,Inspector Notes,textarea,,,');
      lines.should.have.lengthOf(6);
    });

    it('should not write the old four-row metadata block', function() {
      var output = csv.buildTravelerCsv({
        record: record(),
        url: URL,
        fields: FIELDS,
      });
      output.should.not.include('Traveler Link');
      output.should.not.include('Traveler Id');
      output.should.not.include('Traveler Title');
      output.should.not.include('Traveler Status');
    });

    it('should still write the data header row when there are no fields', function() {
      var output = csv.buildTravelerCsv({
        record: record({ title: 'Empty Traveler', status: 'initialized' }),
        url: URL,
        fields: [],
      });
      var lines = output.split('\n');
      lines.should.have.lengthOf(4);
      lines[0].should.equal(HEADER);
      lines[2].should.equal('');
      lines[3].should.equal(DATA_HEADER);
    });

    it('should write the status by name, never as a number', function() {
      var output = csv.buildTravelerCsv({
        record: record({ status: 'completed' }),
        url: URL,
        fields: [],
      });
      var cells = output.split('\n')[1].split(',');
      cells[3].should.equal('completed');
      output.split('\n')[1].should.not.match(/,\d(\.\d)?,jdoe,/);
    });

    it('should write dates as ISO 8601 UTC and tags joined with semicolons', function() {
      var cells = csv
        .buildTravelerCsv({
          record: record({
            archivedOn: new Date('2026-09-20T01:02:03.004Z'),
            tags: ['a', 'b', 'c'],
          }),
          url: URL,
          fields: [],
        })
        .split('\n')[1]
        .split(',');
      cells[5].should.equal('2026-08-30T14:02:11.000Z');
      cells[7].should.equal('2026-09-14T09:41:03.000Z');
      cells[8].should.equal('2026-09-20T01:02:03.004Z');
      cells[10].should.equal('a;b;c');
    });

    it('should leave a missing value as an empty cell, and keep the url', function() {
      var cells = csv
        .buildTravelerCsv({ record: {}, url: URL, fields: [] })
        .split('\n')[1]
        .split(',');
      cells.should.have.lengthOf(19);
      cells[0].should.equal('');
      cells[1].should.equal(URL);
      cells.slice(2).forEach(function(cell) {
        cell.should.equal('');
      });
    });

    it('should write a zero count as 0', function() {
      var cells = csv
        .buildTravelerCsv({
          record: record({ totalInput: 0, finishedInput: 0 }),
          url: URL,
          fields: [],
        })
        .split('\n')[1]
        .split(',');
      cells[11].should.equal('0');
      cells[12].should.equal('0');
    });

    it('should show text that starts a formula as text in the metadata row', function() {
      var output = csv.buildTravelerCsv({
        record: record({
          title: '=SUM(A1), "draft"',
          owner: '@boss',
          subsystem: '-1+2',
          tags: ['=1', 'ok'],
        }),
        url: URL,
        fields: [],
      });
      output.should.include('"\'=SUM(A1), ""draft"""');
      output.should.include(",'@boss,");
      output.should.include(",'-1+2,");
      output.should.include(",'=1;ok,");
    });

    it('should keep a comma, a quote, and a line break in one metadata cell', function() {
      var output = csv.buildTravelerCsv({
        record: record({ title: 'a, "b"\nc' }),
        url: URL,
        fields: [],
      });
      output.should.include('"a, ""b""\nc"');
    });

    it('should keep international characters intact', function() {
      var output = csv.buildTravelerCsv({
        record: record({ title: 'Kühlung – 冷却 ✓' }),
        url: URL,
        fields: [],
      });
      output.should.include('Kühlung – 冷却 ✓');
    });

    it('should not change the record it is given', function() {
      var original = record({ title: '=1', tags: ['x'] });
      var copy = JSON.parse(JSON.stringify(original));
      csv.buildTravelerCsv({ record: original, url: URL, fields: [] });
      JSON.parse(JSON.stringify(original)).should.deep.equal(copy);
      original.should.not.have.property('url');
    });
  });

  describe('#recordCell', function() {
    it('should give an empty cell for a missing value', function() {
      csv.recordCell({}, 'title').should.equal('');
      csv.recordCell({ title: null }, 'title').should.equal('');
    });

    it('should write a date as ISO 8601 UTC', function() {
      csv
        .recordCell({ d: new Date('2026-01-02T03:04:05.006Z') }, 'd')
        .should.equal('2026-01-02T03:04:05.006Z');
    });

    it('should join a list with semicolons', function() {
      csv.recordCell({ tags: ['a', 'b'] }, 'tags').should.equal('a;b');
      csv.recordCell({ tags: [] }, 'tags').should.equal('');
    });

    it('should write an identifier object as its text', function() {
      var id = {
        toString: function() {
          return '64f1a2b3c4d5e6f7a8b9c0d1';
        },
      };
      csv
        .recordCell({ _id: id }, '_id')
        .should.equal('64f1a2b3c4d5e6f7a8b9c0d1');
    });

    it('should keep numbers as numbers, including zero, and text as it is', function() {
      csv.recordCell({ n: 0 }, 'n').should.equal(0);
      csv.recordCell({ n: 36 }, 'n').should.equal(36);
      csv.recordCell({ s: 'abc' }, 's').should.equal('abc');
    });

    it('should name the record columns, and TRAVELER_COLUMNS adds only url', function() {
      csv.RECORD_COLUMNS.should.have.lengthOf(18);
      csv.RECORD_COLUMNS[0].should.equal('_id');
      csv.TRAVELER_COLUMNS.filter(function(c) {
        return c !== 'url';
      }).should.deep.equal(csv.RECORD_COLUMNS);
    });
  });

  describe('#neutralizeFormula', function() {
    it('should prefix a single quote to text that starts a formula', function() {
      ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '\r=1'].forEach(function(value) {
        csv.neutralizeFormula(value).should.equal("'" + value);
      });
    });

    it('should leave other text untouched', function() {
      ['hello', '', ' =1', 'a=b', 'a+b', "'quoted", '1-2', '#tag'].forEach(
        function(value) {
          csv.neutralizeFormula(value).should.equal(value);
        }
      );
    });

    it('should leave values that are not text untouched', function() {
      csv.neutralizeFormula(5).should.equal(5);
      csv.neutralizeFormula(-5).should.equal(-5);
      (csv.neutralizeFormula(null) === null).should.be.true;
      (csv.neutralizeFormula(undefined) === undefined).should.be.true;
      var date = new Date();
      csv.neutralizeFormula(date).should.equal(date);
    });
  });

  describe('#toSafeCsvRow', function() {
    it('should neutralize a formula and still escape it', function() {
      csv
        .toSafeCsvRow(['=SUM(A1), "draft"', 5])
        .should.equal('"\'=SUM(A1), ""draft""",5');
    });

    it('should neutralize each value of the row', function() {
      csv.toSafeCsvRow(['ok', '=1', '@x', '-3']).should.equal("ok,'=1,'@x,'-3");
    });

    it('should agree with toCsvRow when nothing needs neutralizing', function() {
      var values = ['a', 'b,c', 'd"e', 7, null];
      csv.toSafeCsvRow(values).should.equal(csv.toCsvRow(values));
    });

    it('should not change what toCsvRow and escapeCsvValue do', function() {
      csv.escapeCsvValue('=1').should.equal('=1');
      csv.toCsvRow(['=1', '-2']).should.equal('=1,-2');
    });
  });
});
