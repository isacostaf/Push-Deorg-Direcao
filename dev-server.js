require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

const { checkBatch, getTodayBR } = require('./src/checker');
const { checkBatchDatas } = require('./src/checker-datas');
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

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] });
    res.end(data);
  });
}

/* ================= ANTIGO ================= */
async function handleCheckBatch(req, res) {
  const body = await readBody(req);
  const { codes } = JSON.parse(body.toString());

  const date = getTodayBR();
  const results = await checkBatch(codes, date);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ date, results }));
  
}

/* ================= NOVO (DATAS) ================= */
async function handleCheckDatas(req, res) {
  const body = await readBody(req);
  const { codes, dateFrom, dateTo } = JSON.parse(body.toString());

    console.log('\n========== CHECK DATAS ==========');
  console.log('dateFrom:', dateFrom);
  console.log('dateTo:', dateTo);
  console.log('codes:', codes);
  console.log('=================================\n');

  const results = await checkBatchDatas(codes, dateFrom, dateTo);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    dateFrom,
    dateTo,
    results
  }));
}

/* ================= SERVER ================= */
const server = http.createServer(async (req, res) => {
  adaptRes(res);

  if (req.method === 'POST' && req.url === '/api/check-batch') {
    return handleCheckBatch(req, res);
  }

  if (req.method === 'POST' && req.url === '/api/check-datas') {
    return handleCheckDatas(req, res);
  }

  if (req.method === 'POST' && req.url === '/api/send-email') {
    const body = await readBody(req);
    req.body = JSON.parse(body.toString());
    await handleSendEmail(req, res);
    return;
  }

  if (req.method === 'GET') {
    return serveStatic(req, res);
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`🚀 Rodando em http://localhost:${PORT}`);
});