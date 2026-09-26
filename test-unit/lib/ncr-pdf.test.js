const { expect } = require('chai');

process.env.TRAVELER_CONFIG_REL_PATH = 'docker';

const { buildNcrPdfModel, renderNcrPdf } = require('../../lib/ncr-pdf');

// The section order is the one in specs/124-traveler-input-ncr-gating
// contracts/traveler-ncr-pdfs.json (pdf_content.sections_in_order).
const HEADINGS = [
  'Summary',
  'Traveler and Input',
  'Part, Supplier and Reference',
  'Nonconformance',
  'People',
  'Disposition',
  'Review and Approval',
  'Preventive Actions',
  'Closure',
  'Attachments',
  'Event History',
];

/** A fully populated, closed, traveler-linked NCR as a plain object. */
function fullNcr(overrides = {}) {
  return {
    ncr_number: 'NCR-2026-0007',
    status: 'Closed',
    creation_timestamp: new Date('2026-03-02T09:30:00Z'),
    originator_name: 'Olivia Originator',
    originator_designate_name: 'Dan Designate',
    part_name: 'Cavity bracket',
    part_number: 'CB-100',
    part_revision: 'B',
    quantity: 4,
    supplier_name: 'Acme Machining',
    wbs_number: '1.2.3',
    specification_drawing_reference: 'DWG-9001',
    po_reference: 'PO-5550',
    description_of_nonconformance: 'Bore is out of tolerance at 4.7 Ω.',
    discovery_date: new Date('2026-03-01T00:00:00Z'),
    discovery_context: 'incoming_inspection',
    ce_cs_name: 'Carla Engineer',
    qa_staff_name: 'Quinn QA',
    qa_concurrence_timestamp: new Date('2026-03-04T10:00:00Z'),
    traveler_link: {
      traveler_id: '507f1f77bcf86cd799439011',
      input_name: 'field_1',
      input_label: 'Bore diameter',
      initiated_from_traveler: true,
    },
    disposition: {
      parts_disposition: 'Rework',
      rework_repair_instructions: 'Re-bore to spec and re-inspect.',
      ce_cs_identity: 'carla',
      ce_cs_timestamp: new Date('2026-03-03T15:00:00Z'),
    },
    additional_approvers: [
      {
        approver_name: 'Ada Approver',
        approval_status: 'Approved',
        approval_timestamp: new Date('2026-03-05T11:00:00Z'),
        comments: 'Looks fine.',
      },
      {
        approver_name: 'Ben Approver',
        approval_status: 'Returned for Comment',
        approval_timestamp: new Date('2026-03-05T12:00:00Z'),
        comments: 'Add the re-inspection record.',
      },
    ],
    preventive_actions: [
      {
        action_description: 'Add a bore gauge check',
        owner_name: 'Pat Owner',
        target_completion_date: new Date('2026-04-01T00:00:00Z'),
        actual_completion_date: new Date('2026-03-30T00:00:00Z'),
        status: 'Completed',
        comments: ['Done', 'Verified'],
      },
    ],
    closure_record: {
      closed_by_name: 'Olivia Originator',
      closure_date: new Date('2026-03-10T00:00:00Z'),
      disposition_execution_verified: true,
      preventive_actions_verified: false,
      traveler_signed_off: true,
    },
    attachments: [
      {
        file_name: 'inspection-report.pdf',
        file_path: '/secret/uploads/abc123',
      },
      { file_name: 'photo.jpg', file_path: '/secret/uploads/def456' },
    ],
    events: [
      {
        timestamp: new Date('2026-03-02T09:30:00Z'),
        event_type: 'ncr.submitted',
        actor_name: 'Olivia Originator',
        new_status: 'Submitted',
      },
      {
        timestamp: new Date('2026-03-10T00:00:00Z'),
        event_type: 'ncr.closed',
        actor_name: 'Olivia Originator',
        previous_status: 'Final Approval',
        new_status: 'Closed',
      },
    ],
    ...overrides,
  };
}

/** The value in a `rows` section for a label, or undefined. */
function rowValue(section, label) {
  const row = (section.rows || []).find(r => r[0] === label);
  return row && row[1];
}

function section(model, heading) {
  return model.sections.find(s => s.heading === heading);
}

/** Counts the page objects in a rendered PDF (page dictionaries are not compressed). */
function pageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type \/Page(?![s\w])/g) || [])
    .length;
}

describe('lib/ncr-pdf — buildNcrPdfModel', () => {
  it('produces the sections of the closure record, in the documented order', () => {
    const model = buildNcrPdfModel(fullNcr(), {
      travelerTitle: 'Cryomodule 7',
    });
    expect(model.title).to.equal('NCR-2026-0007');
    expect(model.sections.map(s => s.heading)).to.deep.equal(HEADINGS);
  });

  it('identifies the NCR: number, status and key dates', () => {
    const summary = section(buildNcrPdfModel(fullNcr()), 'Summary');
    expect(rowValue(summary, 'NCR Number')).to.equal('NCR-2026-0007');
    expect(rowValue(summary, 'Status')).to.equal('Closed');
    expect(rowValue(summary, 'Created')).to.equal('2026-03-02 09:30 UTC');
    expect(rowValue(summary, 'Closed')).to.equal('2026-03-10 00:00 UTC');
  });

  it('names the traveler and the input the NCR was raised against', () => {
    const model = buildNcrPdfModel(fullNcr(), {
      travelerTitle: 'Cryomodule 7',
    });
    const traveler = section(model, 'Traveler and Input');
    expect(rowValue(traveler, 'Traveler')).to.contain('Cryomodule 7');
    expect(rowValue(traveler, 'Traveler')).to.contain(
      '507f1f77bcf86cd799439011'
    );
    expect(rowValue(traveler, 'Input')).to.equal('Bore diameter');
    expect(rowValue(traveler, 'Input Name')).to.equal('field_1');
  });

  it('includes part, supplier, PO, WBS and reference information', () => {
    const part = section(
      buildNcrPdfModel(fullNcr()),
      'Part, Supplier and Reference'
    );
    expect(rowValue(part, 'Part Name')).to.equal('Cavity bracket');
    expect(rowValue(part, 'Part Number')).to.equal('CB-100');
    expect(rowValue(part, 'Revision')).to.equal('B');
    expect(rowValue(part, 'Quantity')).to.equal('4');
    expect(rowValue(part, 'Supplier')).to.equal('Acme Machining');
    expect(rowValue(part, 'WBS Number')).to.equal('1.2.3');
    expect(rowValue(part, 'Specification / Drawing Ref.')).to.equal('DWG-9001');
    expect(rowValue(part, 'PO Reference')).to.equal('PO-5550');
  });

  it('includes the description and discovery details', () => {
    const nc = section(buildNcrPdfModel(fullNcr()), 'Nonconformance');
    expect(rowValue(nc, 'Description')).to.equal(
      'Bore is out of tolerance at 4.7 Ω.'
    );
    expect(rowValue(nc, 'Discovery Date')).to.equal('2026-03-01 00:00 UTC');
    expect(rowValue(nc, 'Discovery Context')).to.equal('incoming_inspection');
  });

  it('includes the originator, designate, CE/CS and QA staff', () => {
    const people = section(buildNcrPdfModel(fullNcr()), 'People');
    expect(rowValue(people, 'Originator')).to.equal('Olivia Originator');
    expect(rowValue(people, 'Originator Designate')).to.equal('Dan Designate');
    expect(rowValue(people, 'CE/CS')).to.equal('Carla Engineer');
    expect(rowValue(people, 'QA Staff')).to.equal('Quinn QA');
  });

  it('includes the disposition', () => {
    const disposition = section(buildNcrPdfModel(fullNcr()), 'Disposition');
    expect(rowValue(disposition, 'Parts Disposition')).to.equal('Rework');
    expect(rowValue(disposition, 'Rework / Repair Instructions')).to.equal(
      'Re-bore to spec and re-inspect.'
    );
    expect(rowValue(disposition, 'Dispositioned By')).to.equal('carla');
    expect(rowValue(disposition, 'Dispositioned On')).to.equal(
      '2026-03-03 15:00 UTC'
    );
  });

  it('lists the QA concurrence and every approver with outcome, date and comments', () => {
    const { table } = section(
      buildNcrPdfModel(fullNcr()),
      'Review and Approval'
    );
    expect(table.head).to.deep.equal([
      'Reviewer',
      'Outcome',
      'Date',
      'Comments',
    ]);
    expect(table.rows).to.have.length(3);
    expect(table.rows[0]).to.deep.equal([
      'QA Staff — Quinn QA',
      'Concurred',
      '2026-03-04 10:00 UTC',
      '—',
    ]);
    expect(table.rows[1]).to.deep.equal([
      'Ada Approver',
      'Approved',
      '2026-03-05 11:00 UTC',
      'Looks fine.',
    ]);
    expect(table.rows[2][1]).to.equal('Returned for Comment');
  });

  it('lists each preventive action', () => {
    const { table } = section(
      buildNcrPdfModel(fullNcr()),
      'Preventive Actions'
    );
    expect(table.head).to.deep.equal([
      'Action',
      'Owner',
      'Target',
      'Completed',
      'Status',
      'Comments',
    ]);
    expect(table.rows).to.have.length(1);
    expect(table.rows[0][0]).to.equal('Add a bore gauge check');
    expect(table.rows[0][1]).to.equal('Pat Owner');
    expect(table.rows[0][4]).to.equal('Completed');
    expect(table.rows[0][5]).to.equal('Done; Verified');
  });

  it('includes the closure record with the traveler sign-off', () => {
    const closure = section(buildNcrPdfModel(fullNcr()), 'Closure');
    expect(rowValue(closure, 'Closed By')).to.equal('Olivia Originator');
    expect(rowValue(closure, 'Closure Date')).to.equal('2026-03-10 00:00 UTC');
    expect(rowValue(closure, 'Disposition Execution Verified')).to.equal('Yes');
    expect(rowValue(closure, 'Preventive Actions Verified')).to.equal('No');
    expect(rowValue(closure, 'Traveler Sign-off')).to.equal('Yes');
  });

  it('lists attachment file names only — never their paths or contents', () => {
    const model = buildNcrPdfModel(fullNcr());
    const { table } = section(model, 'Attachments');
    expect(table.rows).to.deep.equal([
      ['inspection-report.pdf'],
      ['photo.jpg'],
    ]);
    expect(JSON.stringify(model)).to.not.contain('/secret/uploads');
  });

  it('lists every event in order with its time, actor and status change', () => {
    const { table } = section(buildNcrPdfModel(fullNcr()), 'Event History');
    expect(table.head).to.deep.equal(['Time', 'Event', 'Actor', 'Status']);
    expect(table.rows).to.deep.equal([
      [
        '2026-03-02 09:30 UTC',
        'ncr.submitted',
        'Olivia Originator',
        'Submitted',
      ],
      [
        '2026-03-10 00:00 UTC',
        'ncr.closed',
        'Olivia Originator',
        'Final Approval → Closed',
      ],
    ]);
  });

  it('shows a dash for a missing value rather than throwing', () => {
    const people = section(
      buildNcrPdfModel(fullNcr({ originator_designate_name: undefined })),
      'People'
    );
    expect(rowValue(people, 'Originator Designate')).to.equal('—');
  });

  it('notes an empty optional section instead of leaving it blank or throwing', () => {
    const model = buildNcrPdfModel(
      fullNcr({
        disposition: undefined,
        preventive_actions: [],
        attachments: [],
        additional_approvers: [],
        qa_staff_name: undefined,
      })
    );
    expect(section(model, 'Preventive Actions').note).to.equal('None recorded');
    expect(section(model, 'Attachments').note).to.equal('None recorded');
    expect(section(model, 'Review and Approval').note).to.equal(
      'None recorded'
    );
    expect(
      rowValue(section(model, 'Disposition'), 'Parts Disposition')
    ).to.equal('—');
  });

  it('copes with an NCR that carries almost nothing', () => {
    const model = buildNcrPdfModel({ ncr_number: 'NCR-2026-0001' });
    expect(model.sections.map(s => s.heading)).to.deep.equal(HEADINGS);
    expect(section(model, 'Traveler and Input').note).to.equal(
      'Not linked to a traveler'
    );
  });

  it('formats a Mongoose-style document through toObject()', () => {
    const plain = fullNcr();
    const model = buildNcrPdfModel({ toObject: () => plain });
    expect(rowValue(section(model, 'Summary'), 'NCR Number')).to.equal(
      'NCR-2026-0007'
    );
  });
});

describe('lib/ncr-pdf — renderNcrPdf', () => {
  it('renders a PDF buffer', async () => {
    const pdf = await renderNcrPdf(
      buildNcrPdfModel(fullNcr(), { travelerTitle: 'Cryomodule 7' })
    );
    expect(Buffer.isBuffer(pdf)).to.equal(true);
    expect(pdf.slice(0, 5).toString('latin1')).to.equal('%PDF-');
    expect(pdf.length).to.be.greaterThan(1500);
  });

  it('draws engineering symbols and accented letters without failing', async () => {
    const ncr = fullNcr({
      description_of_nonconformance:
        'R = 4.7 Ω ± 5 %, needs ≥ 5 Ω; Δ = 0.3 µm; José Müller',
    });
    const pdf = await renderNcrPdf(buildNcrPdfModel(ncr));
    expect(pdf.slice(0, 5).toString('latin1')).to.equal('%PDF-');
  });

  it('does not fail on characters the font lacks (they render as the missing-glyph box)', async () => {
    const pdf = await renderNcrPdf(
      buildNcrPdfModel(fullNcr({ part_name: '温度 sensor' }))
    );
    expect(pdf.slice(0, 5).toString('latin1')).to.equal('%PDF-');
  });

  it('renders an NCR that carries almost nothing', async () => {
    const pdf = await renderNcrPdf(
      buildNcrPdfModel({ ncr_number: 'NCR-2026-0001' })
    );
    expect(pdf.slice(0, 5).toString('latin1')).to.equal('%PDF-');
  });

  // pdfkit lays a table out at roughly 13 ms per row, so a long history is slow
  // to render: 120 events (well beyond a real NCR) take about 1.5 s. It is here to
  // prove the content flows across pages, hence the longer timeout.
  it('paginates a long description and a long history across several pages', async function() {
    this.timeout(20000);
    const events = [];
    for (let i = 0; i < 120; i += 1) {
      events.push({
        timestamp: new Date(Date.UTC(2026, 2, 1, 0, i)),
        event_type: 'notification.initial',
        actor_name: 'System',
      });
    }
    const ncr = fullNcr({
      description_of_nonconformance: 'word '.repeat(400),
      events,
    });
    const pdf = await renderNcrPdf(buildNcrPdfModel(ncr));
    expect(pageCount(pdf)).to.be.greaterThan(3);
  });

  it('keeps a short NCR to a page or two', async () => {
    const pdf = await renderNcrPdf(buildNcrPdfModel(fullNcr()));
    expect(pageCount(pdf)).to.be.within(1, 3);
  });
});
