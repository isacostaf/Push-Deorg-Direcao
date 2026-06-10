const { checkBatch, getTodayBR } = require('../src/checker');

const MAX_BATCH_SIZE = 5;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const codes = body?.codes;

    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um código de processo.' });
    }

    if (codes.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: `Máximo de ${MAX_BATCH_SIZE} processos por lote.`,
      });
    }

    const date = getTodayBR();
    const results = await checkBatch(codes, date);

    return res.status(200).json({ date, results });
  } catch (err) {
    console.error('Erro no lote:', err);
    return res.status(500).json({ error: err.message || 'Erro ao consultar DOU.' });
  }
}
