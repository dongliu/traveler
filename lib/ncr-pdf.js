/**
 * The PDF record of a closed NCR, attached to the traveler input it was raised
 * against (spec 124-traveler-input-ncr-gating, FR-022..FR-029).
 *
 * Two layers, so the content can be tested without decoding a PDF:
 *  - buildNcrPdfModel(ncr) is pure. It turns an NCR into an ordered list of
 *    sections — what the record says.
 *  - renderNcrPdf(model) draws that list with pdfkit — how it looks.
 *
 * The PDF is a snapshot of the NCR as it stands at closure. It is drawn as text
 * only: NCR content is never interpreted as HTML, a link or an image, so nothing
 * a user typed can inject markup or trigger a fetch. Attachments are listed by
 * file name; their contents and server paths never appear.
 *
 * pdfkit's built-in fonts only cover Latin-1, and engineering text routinely
 * contains characters such as Ω, ≥ and Δ, so DejaVu Sans is embedded. A
 * character DejaVu Sans lacks (e.g. CJK) is drawn as the font's missing-glyph
 * box; it never makes generation fail.
 */

const PDFDocument = require('pdfkit');

const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
const BODY = 'Body';
const BOLD = 'Bold';
const MARGIN = 54;
const DASH = '—';
const NONE_RECORDED = 'None recorded';

// ── formatting ───────────────────────────────────────────────────────────────

function text(value) {
  if (value === undefined || value === null || value === '') {
    return DASH;
  }
  return String(value);
}

/** `YYYY-MM-DD HH:mm UTC` — unambiguous whichever timezone the reader is in. */
function formatDate(value) {
  if (!value) {
    return DASH;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return DASH;
  }
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function yesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return DASH;
}

function rowsSection(heading, rows) {
  return { heading, rows: rows.map(([label, value]) => [label, text(value)]) };
}

function tableSection(heading, head, rows, widths) {
  if (rows.length === 0) {
    return { heading, note: NONE_RECORDED };
  }
  return { heading, table: { head, rows, widths } };
}

// ── content ──────────────────────────────────────────────────────────────────

/**
 * What the closure record says, as an ordered list of sections. A section is
 * `{ heading, rows: [[label, value]] }`, `{ heading, table: { head, rows,
 * widths } }` (widths are relative column weights) or `{ heading, note }` when
 * there is nothing to show. Every value is already a string.
 *
 * The sections, in order, are the ones listed in
 * specs/124-traveler-input-ncr-gating/contracts/traveler-ncr-pdfs.json.
 *
 * @param  {Object} ncrInput       the NCR (a plain object or a Mongoose document)
 * @param  {Object} [options]
 * @param  {String} [options.travelerTitle] the linked traveler's title, if known
 * @return {{title: String, sections: Array<Object>}}
 */
function buildNcrPdfModel(ncrInput, { travelerTitle } = {}) {
  const ncr =
    typeof ncrInput.toObject === 'function' ? ncrInput.toObject() : ncrInput;
  const link =
    ncr.traveler_link && ncr.traveler_link.traveler_id
      ? ncr.traveler_link
      : null;
  const disposition = ncr.disposition || {};
  const closure = ncr.closure_record || {};

  const summary = rowsSection('Summary', [
    ['NCR Number', ncr.ncr_number],
    ['Status', ncr.status],
    ['Created', formatDate(ncr.creation_timestamp)],
    ['Closed', formatDate(closure.closure_date || closure.closure_timestamp)],
  ]);

  const traveler = link
    ? rowsSection('Traveler and Input', [
        [
          'Traveler',
          travelerTitle
            ? `${travelerTitle} (${link.traveler_id})`
            : String(link.traveler_id),
        ],
        ['Input', link.input_label || link.input_name],
        ['Input Name', link.input_name],
      ])
    : { heading: 'Traveler and Input', note: 'Not linked to a traveler' };

  const part = rowsSection('Part, Supplier and Reference', [
    ['Part Name', ncr.part_name],
    ['Part Number', ncr.part_number],
    ['Revision', ncr.part_revision],
    ['Quantity', ncr.quantity],
    ['Supplier', ncr.supplier_name],
    ['WBS Number', ncr.wbs_number],
    ['Specification / Drawing Ref.', ncr.specification_drawing_reference],
    ['PO Reference', ncr.po_reference],
  ]);

  const nonconformance = rowsSection('Nonconformance', [
    ['Discovery Date', formatDate(ncr.discovery_date)],
    ['Discovery Context', ncr.discovery_context],
    ['Description', ncr.description_of_nonconformance],
  ]);

  const people = rowsSection('People', [
    ['Originator', ncr.originator_name],
    ['Originator Designate', ncr.originator_designate_name],
    ['CE/CS', ncr.ce_cs_name],
    ['QA Staff', ncr.qa_staff_name],
  ]);

  const dispositionSection = rowsSection('Disposition', [
    ['Parts Disposition', disposition.parts_disposition],
    ['Rework / Repair Instructions', disposition.rework_repair_instructions],
    ['Dispositioned By', disposition.ce_cs_identity],
    ['Dispositioned On', formatDate(disposition.ce_cs_timestamp)],
  ]);

  const reviewRows = [];
  if (ncr.qa_staff_name || ncr.qa_staff_identity) {
    reviewRows.push([
      `QA Staff — ${text(ncr.qa_staff_name || ncr.qa_staff_identity)}`,
      'Concurred',
      formatDate(ncr.qa_concurrence_timestamp),
      DASH,
    ]);
  }
  (ncr.additional_approvers || []).forEach(approver => {
    reviewRows.push([
      text(approver.approver_name || approver.approver_id),
      text(approver.approval_status || 'Pending'),
      formatDate(approver.approval_timestamp),
      text(approver.comments),
    ]);
  });
  const review = tableSection(
    'Review and Approval',
    ['Reviewer', 'Outcome', 'Date', 'Comments'],
    reviewRows,
    [3, 2, 2, 4]
  );

  const preventive = tableSection(
    'Preventive Actions',
    ['Action', 'Owner', 'Target', 'Completed', 'Status', 'Comments'],
    (ncr.preventive_actions || []).map(action => [
      text(action.action_description),
      text(action.owner_name),
      formatDate(action.target_completion_date),
      formatDate(action.actual_completion_date),
      text(action.status),
      text((action.comments || []).join('; ')),
    ]),
    [4, 2, 2, 2, 2, 3]
  );

  const closureSection = rowsSection('Closure', [
    ['Closed By', closure.closed_by_name],
    [
      'Closure Date',
      formatDate(closure.closure_date || closure.closure_timestamp),
    ],
    [
      'Disposition Execution Verified',
      yesNo(closure.disposition_execution_verified),
    ],
    ['Preventive Actions Verified', yesNo(closure.preventive_actions_verified)],
    ['Traveler Sign-off', yesNo(closure.traveler_signed_off)],
  ]);

  // file names only: neither the contents nor the server-side path is ever shown
  const attachments = tableSection(
    'Attachments',
    ['File'],
    (ncr.attachments || []).map(attachment => [text(attachment.file_name)]),
    [1]
  );

  const history = tableSection(
    'Event History',
    ['Time', 'Event', 'Actor', 'Status'],
    (ncr.events || []).map(event => [
      formatDate(event.timestamp),
      text(event.event_type),
      event.actor_name || (event.actor_type === 'system' ? 'System' : DASH),
      event.previous_status && event.new_status
        ? `${event.previous_status} → ${event.new_status}`
        : text(event.new_status),
    ]),
    [3, 4, 3, 4]
  );

  return {
    title: text(ncr.ncr_number),
    sections: [
      summary,
      traveler,
      part,
      nonconformance,
      people,
      dispositionSection,
      review,
      preventive,
      closureSection,
      attachments,
      history,
    ],
  };
}

// ── drawing ──────────────────────────────────────────────────────────────────

function contentWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

function usableBottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function drawHeading(doc, heading) {
  const width = contentWidth(doc);
  // keep a heading together with the start of what it introduces
  if (doc.y + 60 > usableBottom(doc)) {
    doc.addPage();
  }
  doc.moveDown(0.8);
  doc
    .font(BOLD)
    .fontSize(12)
    .fillColor('#1a1a1a')
    .text(heading, MARGIN, doc.y, { width });
  const ruleY = doc.y + 2;
  doc
    .moveTo(MARGIN, ruleY)
    .lineTo(MARGIN + width, ruleY)
    .lineWidth(0.5)
    .strokeColor('#999999')
    .stroke();
  doc.x = MARGIN;
  doc.y = ruleY + 6;
}

function drawRows(doc, rows) {
  const width = contentWidth(doc);
  const labelWidth = 150;
  const gap = 10;
  const valueWidth = width - labelWidth - gap;
  rows.forEach(([label, value]) => {
    doc.font(BOLD).fontSize(9);
    const labelHeight = doc.heightOfString(label, { width: labelWidth });
    doc.font(BODY).fontSize(10);
    const valueHeight = doc.heightOfString(value, { width: valueWidth });
    const height = Math.max(labelHeight, valueHeight);
    const available = usableBottom(doc) - doc.page.margins.top;
    if (height > available) {
      // taller than a page: stack the two and let the text flow across pages
      doc
        .font(BOLD)
        .fontSize(9)
        .fillColor('#333333')
        .text(label, MARGIN, doc.y, { width });
      doc
        .font(BODY)
        .fontSize(10)
        .fillColor('#000000')
        .text(value, MARGIN, doc.y, { width });
      doc.moveDown(0.4);
      return;
    }
    if (doc.y + height > usableBottom(doc)) {
      doc.addPage();
    }
    const y = doc.y;
    doc
      .font(BOLD)
      .fontSize(9)
      .fillColor('#333333')
      .text(label, MARGIN, y, { width: labelWidth });
    doc
      .font(BODY)
      .fontSize(10)
      .fillColor('#000000')
      .text(value, MARGIN + labelWidth + gap, y, { width: valueWidth });
    doc.x = MARGIN;
    doc.y = y + height + 4;
  });
}

function drawTable(doc, table) {
  const width = contentWidth(doc);
  const weights = table.widths || table.head.map(() => 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const columnStyles = weights.map(weight => ({
    width: (width * weight) / total,
  }));
  const headerCell = value => ({
    text: value,
    font: { src: BOLD, size: 8 },
    backgroundColor: '#eeeeee',
  });
  const bodyCell = value => ({ text: value, font: { src: BODY, size: 8 } });
  doc.table({
    position: { x: MARGIN, y: doc.y },
    maxWidth: width,
    columnStyles,
    defaultStyle: { padding: 3, border: 0.5, borderColor: '#999999' },
    data: [
      table.head.map(headerCell),
      ...table.rows.map(row => row.map(bodyCell)),
    ],
  });
  doc.x = MARGIN;
  doc.moveDown(0.5);
}

function drawFooters(doc, title) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // the footer sits inside the bottom margin; without this pdfkit would start
    // a new page to make room for it
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(BODY)
      .fontSize(8)
      .fillColor('#666666')
      .text(
        `${title} — page ${i + 1} of ${range.count}`,
        MARGIN,
        doc.page.height - 36,
        {
          width: contentWidth(doc),
          align: 'center',
          lineBreak: false,
        }
      );
    doc.page.margins.bottom = bottomMargin;
  }
}

/**
 * Draws a model from buildNcrPdfModel() as a PDF.
 * @param  {{title: String, sections: Array<Object>}} model
 * @return {Promise<Buffer>} the PDF (US Letter)
 */
function renderNcrPdf(model) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: model.title,
        Subject: 'Nonconformance report — closure record',
      },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      doc.registerFont(BODY, FONT_REGULAR);
      doc.registerFont(BOLD, FONT_BOLD);

      doc
        .font(BOLD)
        .fontSize(18)
        .fillColor('#000000')
        .text(model.title, MARGIN, MARGIN);
      doc
        .font(BODY)
        .fontSize(10)
        .fillColor('#555555')
        .text('Nonconformance Report — closure record');

      model.sections.forEach(section => {
        drawHeading(doc, section.heading);
        if (section.note) {
          doc
            .font(BODY)
            .fontSize(10)
            .fillColor('#555555')
            .text(section.note, MARGIN, doc.y, { width: contentWidth(doc) });
        } else if (section.rows) {
          drawRows(doc, section.rows);
        } else if (section.table) {
          drawTable(doc, section.table);
        }
      });

      drawFooters(doc, model.title);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildNcrPdfModel, renderNcrPdf };
