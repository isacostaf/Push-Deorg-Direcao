// check-batch-datas.js
const { checkBatch } = require('../src/checker-datas');

const MAX_BATCH_SIZE = 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método não permitido.'
    });
  }

  try {
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;

    const codes = body?.codes;
    const dateDe = body?.dateDe;
    const dateAte = body?.dateAte;

    if (!Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        error: 'Informe ao menos um código de processo.'
      });
    }

    if (!dateDe || !dateAte) {
      return res.status(400).json({
        error: 'Informe as datas inicial e final.'
      });
    }

    if (codes.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: `Máximo de ${MAX_BATCH_SIZE} processos por lote.`,
      });
    }

    const results = await checkBatch(
      codes,
      dateDe,
      dateAte
    );

    return res.status(200).json({
      dateDe,
      dateAte,
      results
    });

  } catch (err) {
    console.error('Erro no lote completo:', err);

    return res.status(500).json({
      error: err.stack || err.message || String(err)
    });
  }
}