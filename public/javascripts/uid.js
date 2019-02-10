/**
 * UID.core.js
 *
 * @author  liud
 */

/** @constructor */
function UID() {}

/**
 * The simplest function to get an UID string.
 * @returns {string} A version 4 UID string.
 */
UID.generate = function() {
  var rand = UID._gri,
    hex = UID._ha;
  return (
    hex(rand(32), 8) + // time_low
    hex(rand(16), 4) + // time_mid
    hex(0x4000 | rand(12), 4) + // time_hi_and_version
    hex(0x8000 | rand(14), 4) + // clock_seq_hi_and_reserved clock_seq_low
    hex(rand(48), 12)
  ); // node
};

/**
 * Returns an unsigned x-bit random integer.
 * @param {int} x A positive integer ranging from 0 to 53, inclusive.
 * @returns {int} An unsigned x-bit random integer (0 <= f(x) < 2^x).
 */
UID._gri = function(x) {
  // _getRandomInt
  if (x < 0) return NaN;
  if (x <= 30) return 0 | (Math.random() * (1 << x));
  if (x <= 53)
    return (
      (0 | (Math.random() * (1 << 30))) +
      (0 | (Math.random() * (1 << (x - 30)))) * (1 << 30)
    );
  return NaN;
};

/**
 * Converts an integer to a zero-filled hexadecimal string.
 * @param {int} num
 * @param {int} length
 * @returns {string}
 */
UID._ha = function(num, length) {
  // _hexAligner
  var str = num.toString(16),
    i = length - str.length,
    z = '0';
  for (; i > 0; i >>>= 1, z += z) {
    if (i & 1) {
      str = z + str;
    }
  }
  return str;
};

/*a short uid*/

UID.generateShort = function() {
  var rand = UID._gri,
    hex = UID._ha;
  return hex(rand(32), 8);
};
