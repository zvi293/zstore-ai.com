// Local dev server for zstore-ai.com: node serve.cjs → http://localhost:5173
// Serves this folder with gzip (like Netlify), no-cache so edits show on reload.
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path'); const zlib = require('node:zlib');
const root = __dirname; const port = Number(process.argv[2] || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, '404.html');
  const type = types[path.extname(file)] || 'application/octet-stream';
  const gz = /^(text\/|application\/(json|manifest|xml))/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const head = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
  if (gz) head['Content-Encoding'] = 'gzip';
  res.writeHead(file.endsWith('404.html') && !p.endsWith('404.html') ? 404 : 200, head);
  const s = fs.createReadStream(file);
  if (gz) s.pipe(zlib.createGzip({ level: 6 })).pipe(res); else s.pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Zstore AI → http://localhost:${port}`));
