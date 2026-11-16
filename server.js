const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyzePdfBuffer } = require('./scripts/analyzer.js');

const PORT = 8089;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Local API endpoint for analyzing PDF completely locally
  if (req.method === 'POST' && req.url === '/api/analyze-pdf') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        console.log(`Received PDF for local analysis (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)...`);
        const startTime = Date.now();
        const report = analyzePdfBuffer(buffer);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Analysis complete in ${duration}s: ${report.total_patterns} patterns, ${report.duplicate_groups_count} duplicate groups.`);
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(report));
      } catch (err) {
        console.error('Error analyzing PDF:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Static files serving
  const safePath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, safePath === '/' ? 'index.html' : safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local server running at http://127.0.0.1:${PORT}`);
});
