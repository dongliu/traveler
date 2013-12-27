var BusBoy = require('busboy'),
  fs = require('fs'),
  path = require('path');

// var auth = require('./auth');

var RE_MIME = /^(?:multipart\/.+)|(?:application\/x-www-form-urlencoded)$/i;

// options will have limit and uploadDir.
exports = module.exports = function (options) {
  return function multipart(req, res, next) {

    if (req.method === 'GET' || req.method === 'HEAD' || !hasBody(req) || !RE_MIME.test(mime(req)) || !req.session.userid) {
      return next();
    }

    var busboy = new BusBoy({
      headers: req.headers,
      limits: {
        fileSize: (options.limit || 1) * 1024 * 1024,
        files: options.files || 1
      }
    });

    req.files = req.files || {};
    req.body = req.body || {};

    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
      // var filePath = path.join(options.uploadDir, filename);
      var filePath = path.join(options.uploadDir, generateShort() + path.extname(filename));

      file.on('limit', function () {
        var err = new Error('File size too large.');
        err.status = 413;
        next(err);
      });

      file.on('end', function () {
        req.files[fieldname] = {
          type: mimetype,
          encoding: encoding,
          name: filename,
          path: path.resolve(filePath)
        };
      });

      file.pipe(fs.createWriteStream(filePath));
    });

    busboy.on('field', function (fieldname, val) {
      req.body[fieldname] = val;
    });

    busboy.on('end', function () {
      next();
    });

    req.pipe(busboy);
  }
};

function hasBody(req) {
  var encoding = 'transfer-encoding' in req.headers,
    length = 'content-length' in req.headers && req.headers['content-length'] !== '0';
  return encoding || length;
}

function mime(req) {
  var str = req.headers['content-type'] || '';
  return str.split(';')[0];
}

/**
 * Returns an unsigned x-bit random integer.
 * @param {int} x A positive integer ranging from 0 to 53, inclusive.
 * @returns {int} An unsigned x-bit random integer (0 <= f(x) < 2^x).
 */
function gri(x) { // _getRandomInt
  if (x < 0) {
    return NaN;
  }
  if (x <= 30) {
    return (0 | Math.random() * (1 << x));
  }
  if (x <= 53) {
    return (0 | Math.random() * (1 << 30)) + (0 | Math.random() * (1 << x - 30)) * (1 << 30);
  }
  return NaN;
}

/**
 * Converts an integer to a zero-filled hexadecimal string.
 * @param {int} num
 * @param {int} length
 * @returns {string}
 */
function ha(num, length) { // _hexAligner
  var str = num.toString(16),
    i = length - str.length,
    z = "0";
  for (; i > 0; i >>>= 1, z += z) {
    if (i & 1) {
      str = z + str;
    }
  }
  return str;
}

/*a short uid*/

function generateShort() {
  var rand = gri,
    hex = ha;
  return hex(rand(32), 8);
}
