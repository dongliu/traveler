function createPDF(selector, fileName, opts) {
  const opt = {
    ...opts,
    margin: 0.5,
    pagebreak: { mode: 'avoid-all' },
    filename: fileName,
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
  };
  const html = window.document.querySelector(selector);
  html2pdf()
    .set(opt)
    .from(html)
    .save();
}
