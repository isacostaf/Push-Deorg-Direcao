const { enviarEmail } = require('../src/email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { date, results, csvContent } = body || {};

    if (!date || !Array.isArray(results)) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    await enviarEmail({ date, results, csvContent });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar email:', err);
    return res.status(500).json({ error: err.message || 'Erro ao enviar email.' });
  }
}
