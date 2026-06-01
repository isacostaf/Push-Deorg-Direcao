const { runChecks } = require('../../src/checker');
const { sendEmail } = require('../../src/mailer');

// This route is called by Vercel Cron at 08:00 BRT (11:00 UTC)
export default async function handler(req, res) {
  // Protect endpoint: only allow Vercel Cron or requests with the secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🚀 Cron iniciado pelo Vercel');
    const { date, results } = await runChecks();
    await sendEmail(date, results);

    const found = results.filter(r => r.found).map(r => r.processCode);
    const notFound = results.filter(r => !r.found && !r.error).map(r => r.processCode);
    const errors = results.filter(r => r.error).map(r => `${r.processCode}: ${r.error}`);

    return res.status(200).json({
      success: true,
      date,
      summary: { total: results.length, found: found.length, notFound: notFound.length, errors: errors.length },
      found,
      notFound,
      errors,
    });
  } catch (err) {
    console.error('❌ Erro no cron:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
