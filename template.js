/*****
 * update root.templatizer to root.spec in spec.js,
 * update root.templatizer to root.input in input.js,
 * every time you update the jade files in /builderview or /inputview and
 * generate the js lib files.
 *****/

var templatizer = require('templatizer');
templatizer(__dirname + '/builderview', __dirname + '/public/builder/spec.js');
templatizer(__dirname + '/inputview', __dirname + '/public/builder/input.js');
