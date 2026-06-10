//dev-server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const { checkBatch, getTodayBR } = require('./src/checker');
const { checkBatchDatas } = require('./src/checker-datas');

const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const MAX_BATCH_SIZE = 5;

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

async function handleCheckBatch(req, res) {
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body.toString());
    const codes = parsed?.codes;

    if (!Array.isArray(codes) || codes.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Informe ao menos um código de processo.' }));
      return;
    }

    if (codes.length > MAX_BATCH_SIZE) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Máximo de ${MAX_BATCH_SIZE} processos por lote.` }));
      return;
    }

    const date = getTodayBR();
    const results = await checkBatch(codes, date);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ date, results }));
  } catch (err) {
    console.error('Erro no lote:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Erro ao consultar DOU.' }));
  }
}

async function handleCheckDatas(req, res) {
  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body.toString());

    const codes = parsed?.codes;
    const dateFrom = parsed?.dateFrom;
    const dateTo = parsed?.dateTo;

    if (!Array.isArray(codes) || codes.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Informe ao menos um código.' }));
    }

    const results = await checkBatchDatas(codes, dateFrom, dateTo);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      dateFrom,
      dateTo,
      results
    }));
  } catch (err) {
    console.error('Erro no datas:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Erro ao consultar datas.' }));
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/check-batch') {
    await handleCheckBatch(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/check-datas') {
  await handleCheckDatas(req, res);
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
