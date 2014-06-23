// update root.templatizer to root.modulename after running this script
var templatizer = require('templatizer');
templatizer(__dirname + '/builderview', __dirname + '/public/builder/spec.js');
templatizer(__dirname + '/inputview', __dirname + '/public/builder/input.js');
