import http from 'http';
import fs from 'fs';
import path from 'path';

const distDir = 'E:\\Vatsal Website\\dist';
const PORT = 4321;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/index.html';
  } else if (!path.extname(urlPath)) {
    // try urlPath/index.html or urlPath.html
    if (fs.existsSync(path.join(distDir, urlPath, 'index.html'))) {
      urlPath = path.join(urlPath, 'index.html');
    } else if (fs.existsSync(path.join(distDir, urlPath + '.html'))) {
      urlPath = urlPath + '.html';
    }
  }

  const filePath = path.join(distDir, urlPath);
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Live Custom Coded Astro site serving at http://localhost:${PORT}`);
  console.log(`Network: http://127.0.0.1:${PORT}`);
});
