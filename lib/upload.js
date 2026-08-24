const allowedUploadMimetypes = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-xpsdocument',
  'application/oxps',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function fileFilter(req, file, cb) {
  if (!file.mimetype) {
    return cb(null, false);
  }
  if (/^(image|text)\//i.test(file.mimetype)) {
    return cb(null, true);
  }
  if (allowedUploadMimetypes.has(file.mimetype)) {
    return cb(null, true);
  }
  return cb(null, false);
}

module.exports = { allowedUploadMimetypes, fileFilter };
