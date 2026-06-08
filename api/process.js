const { runChecksFromBuffer } = require('../src/checker');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    let buffer;

    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (!body?.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      buffer = Buffer.from(body.file, 'base64');
    } else {
      const chunks = [];

      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }

      buffer = Buffer.concat(chunks);
    }

    if (!buffer?.length) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { date, results, outputBuffer } = await runChecksFromBuffer(buffer);

    const found = results.filter(r => r.found).length;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="processos_resultado.xlsx"'
    );
    res.setHeader('X-Process-Date', date);
    res.setHeader('X-Total-Processes', String(results.length));
    res.setHeader('X-Found-Count', String(found));

    return res.status(200).send(outputBuffer);
  } catch (err) {
    console.error('Erro no processamento:', err);
    return res.status(500).json({ error: err.message || 'Erro ao processar planilha.' });
  }
}
