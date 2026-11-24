// Tiny local receiver: POST /save?name=<path> with raw PNG body -> writes into ./out
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const OUT = path.resolve(process.argv[2] || './out');
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/save') { res.statusCode = 404; res.end(); return; }
  const name = (u.searchParams.get('name') || '').replace(/[^\w./-]/g, '');
  const dest = path.join(OUT, name);
  if (!dest.startsWith(OUT)) { res.statusCode = 400; res.end(); return; }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { fs.writeFileSync(dest, Buffer.concat(chunks)); res.end('ok'); });
}).listen(5199, () => console.log('recv on 5199 ->', OUT));
