const { recordExport } = require('../src/db');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    await recordExport();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao registrar export:', err);
    return res.status(500).json({ error: 'Erro ao registrar export.' });
  }
}
