const { getTimestamps } = require('../src/db');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const data = await getTimestamps();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Erro ao ler timestamps:', err);
    return res.status(500).json({ error: 'Erro ao ler timestamps.' });
  }
}
