function createPDF(html, fileName, opts) {
  const opt = {
    ...opts,
    margin: 1,
    pagebreak: { mode: 'avoid-all' },
    filename: fileName,
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
  };
  html += `<p>generated from <a href="${window.location}">${
    window.location
  }</a> on ${Date()}</p>`;
  html2pdf()
    .set(opt)
    .from(html)
    .save();
}
