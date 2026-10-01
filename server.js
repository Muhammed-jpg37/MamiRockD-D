const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(__dirname, reqPath);

  // If requested file does not exist directly, check root for assets (e.g. /index/spell-catalog.json -> spell-catalog.json)
  if (!fs.existsSync(filePath)) {
    const rootCandidate = path.join(__dirname, path.basename(reqPath));
    if (fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile()) {
      filePath = rootCandidate;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to root index.html ONLY for navigation/HTML requests (SPA routing)
      const ext = path.extname(reqPath).toLowerCase();
      if (!ext || ext === '.html') {
        const indexPath = path.join(__dirname, 'index.html');
        fs.stat(indexPath, (indexErr, indexStats) => {
          if (!indexErr && indexStats.isFile()) {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            fs.createReadStream(indexPath).pipe(res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          }
        });
      } else {
        // Return 404 for missing static assets (prevent returning index.html for .json/.js)
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MamiRock D&D Server listening on port ${PORT}`);
});
