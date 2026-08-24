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
    it('should include the metadata block, blank separator, header, and data rows', function() {
      var output = csv.buildTravelerCsv({
        link: 'https://traveler.example.org/travelers/abc123/view',
        id: 'abc123',
        title: 'Pump Assembly Torque Check',
        statusLabel: 'active',
        fields: [
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
        ],
      });
      var lines = output.split('\n');
      lines[0].should.equal(
        'Traveler Link,https://traveler.example.org/travelers/abc123/view'
      );
      lines[1].should.equal('Traveler Id,abc123');
      lines[2].should.equal('Traveler Title,Pump Assembly Torque Check');
      lines[3].should.equal('Traveler Status,active');
      lines[4].should.equal('');
      lines[5].should.equal('Field Name,Label,Type,Value,Input By,Input On');
      lines[6].should.equal('torque,Torque Reading,number,42,jdoe,1787234591');
      lines[7].should.equal('notes,Inspector Notes,textarea,,,');
      lines.should.have.lengthOf(8);
    });

    it('should still include the data header row when there are no fields', function() {
      var output = csv.buildTravelerCsv({
        link: 'https://traveler.example.org/travelers/abc123/view',
        id: 'abc123',
        title: 'Empty Traveler',
        statusLabel: 'initialized',
        fields: [],
      });
      var lines = output.split('\n');
      lines.should.have.lengthOf(6);
      lines[5].should.equal('Field Name,Label,Type,Value,Input By,Input On');
    });

    it('should never emit a raw numeric status code', function() {
      var output = csv.buildTravelerCsv({
        link: 'https://traveler.example.org/travelers/abc123/view',
        id: 'abc123',
        title: 'Pump Assembly Torque Check',
        statusLabel: 'active',
        fields: [],
      });
      output.should.include('Traveler Status,active');
      output.should.not.match(/Traveler Status,1(\n|$)/);
    });
  });
});
