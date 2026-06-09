const { recordUpload } = require('../src/db');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    await recordUpload();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao registrar upload:', err);
    return res.status(500).json({ error: 'Erro ao registrar upload.' });
  }
}
