const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const config = require('../config/config');

const docsRoot = path.join(__dirname, '..', 'public', 'docs');

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function page(prefix, body) {
  const vc = config.viewConfig;
  const appName = vc.deploymentName
    ? `Traveler - ${vc.deploymentName}`
    : 'Traveler';
  const term = capitalize((vc.terminology && vc.terminology.form) || 'form');
  const topBarLinks = (vc.topBarUrls || [])
    .map(u => `<li><a href="${u.url}" target="_blank">${u.text}</a></li>`)
    .join('');
  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="X-UA-Compatible" content="IE=Edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Documentation</title>
  <link rel="stylesheet" href="${prefix}/bootstrap/css/bootstrap.css">
  <link rel="stylesheet" href="${prefix}/bootstrap/css/bootstrap-responsive.css">
  <link rel="stylesheet" href="${prefix}/font-awesome-4.3.0/css/font-awesome.css">
  <link rel="stylesheet" href="${prefix}/stylesheets/style.css">
  <link rel="stylesheet" href="${prefix}/stylesheets/doc.css">
</head>
<body>
  <div class="navbar navbar-fixed-top">
    <div class="navbar-inner">
      <div class="container-fluid">
        <div class="nav-collapse collapse">
          <ul class="nav">
            <li><a href="${prefix}/">${appName}</a></li>
            ${topBarLinks}
            <li><a href="${prefix}/forms/" class="caps">Draft ${term}s</a></li>
            <li><a href="${prefix}/releasedforms/" class="caps">Released ${term}s</a></li>
            <li><a href="${prefix}/travelers/">Travelers</a></li>
            <li><a href="${prefix}/binders/">Binders</a></li>
            <li><a href="${prefix}/docs/">Documents</a></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <div class="container" style="margin-top:60px">
    ${body}
  </div>
  <div class="container-fluid">
    <h6 class="text-right">
      <a href="https://github.com/dongliu/traveler" target="_blank">Release ${vc.appVersion || ''}</a>
    </h6>
  </div>
  <script src="${prefix}/jquery-3.7.1/jquery-3.7.1.min.js"></script>
  <script src="${prefix}/jquery-3.7.1/jquery-migrate-3.6.0.js"></script>
  <script src="${prefix}/bootstrap/js/bootstrap.min.js"></script>
  <script src="${prefix}/javascripts/docs.js"></script>
</body>
</html>`;
}

function serveDoc(req, res, filePath) {
  fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
      return res.status(404).send('Documentation page not found.');
    }
    const prefix = req.proxied_prefix || '';
    res.send(page(prefix, marked.parse(content)));
  });
}

module.exports = function(app) {
  app.get('/docs/', function(req, res) {
    serveDoc(req, res, path.join(docsRoot, 'index.md'));
  });

  app.get('/docs/*', function(req, res) {
    const rel = req.params[0];
    const filePath = path.resolve(docsRoot, rel);
    if (!filePath.startsWith(docsRoot + path.sep)) {
      return res.status(403).send('Forbidden');
    }
    serveDoc(req, res, filePath);
  });
};
