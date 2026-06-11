const { checkBatchDatas } = require('../src/checker-datas');

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

    const { codes, dateFrom, dateTo } = body;

    if (!Array.isArray(codes) || !codes.length) {
      return res.status(400).json({
        error: 'Nenhum código informado.'
      });
    }

    const results = await checkBatchDatas(
      codes,
      dateFrom,
      dateTo
    );

    return res.status(200).json({
      dateFrom,
      dateTo,
      results
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message
    });
  }
}