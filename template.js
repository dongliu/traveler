var templatizer = require('templatizer');
templatizer(__dirname + '/builderview', __dirname + '/public/builder/spec.js', 'spec');
templatizer(__dirname + '/inputview', __dirname + '/public/builder/input.js', 'input');