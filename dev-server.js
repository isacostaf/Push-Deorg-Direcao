require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const handleCheckBatch = require('./api/check-batch');
const handleSendEmail = require('./api/send-email');

const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function adaptRes(res) {
  res.status = (code) => ({
    json: (data) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    },
  });
  return res;
}

function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(PUBLIC, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  adaptRes(res);

  if (req.method === 'POST' && req.url === '/api/check-batch') {
    const body = await readBody(req);
    req.body = JSON.parse(body.toString());
    await handleCheckBatch(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/send-email') {
    const body = await readBody(req);
    req.body = JSON.parse(body.toString());
    await handleSendEmail(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`\n🚀 Dev server rodando em http://localhost:${PORT}\n`);
});
