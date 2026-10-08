// server.js — tiny static server for local dev: node server.js [port]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8137);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.md': 'text/plain' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  // Dev only: the browser can save a rendered PNG into art/_test/ (for proving the painted-art pipeline).
  if (req.method === 'POST' && url.pathname === '/_dev/save') {
    const name = (url.searchParams.get('name') || '').replace(/[^a-z0-9_.-]/gi, '');
    if (!name) { res.writeHead(400).end('name?'); return; }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const dir = join(ROOT, 'art', '_test');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), Buffer.concat(chunks));
    res.writeHead(200).end('saved art/_test/' + name);
    return;
  }
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, () => console.log('Wobblins dev server: http://localhost:' + PORT + '/?debug=1'));
