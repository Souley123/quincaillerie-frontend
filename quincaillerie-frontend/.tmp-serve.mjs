import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html', '.json': 'application/json', '.jpg': 'image/jpeg' };

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url.startsWith('/quincaillerie-frontend')) url = url.slice('/quincaillerie-frontend'.length);
  const fichier = path.join(racine, url === '/' || url === '' ? 'index.html' : url);
  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(4325, '127.0.0.1', () => console.log('serveur 4325'));
