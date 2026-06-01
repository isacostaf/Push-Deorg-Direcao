const nodemailer = require('nodemailer');

function buildEmailHtml(date, results) {
  const found = results.filter(r => r.found);
  const notFound = results.filter(r => !r.found && !r.error);
  const errors = results.filter(r => r.error);

  const rows = results
    .map(r => {
      const status = r.error
        ? `⚠️ Erro: ${r.error}`
        : r.found
        ? '✅ PUBLICADO'
        : '❌ Não encontrado';
      const bg = r.error ? '#fff3cd' : r.found ? '#d4edda' : '#f8d7da';
      return `
        <tr style="background:${bg}">
          <td style="padding:8px 12px;border:1px solid #dee2e6;font-family:monospace">${r.processCode}</td>
          <td style="padding:8px 12px;border:1px solid #dee2e6">${status}</td>
          <td style="padding:8px 12px;border:1px solid #dee2e6;font-size:11px">
            <a href="${r.url}" target="_blank">Ver no DOU</a>
          </td>
        </tr>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px">
  <h2 style="color:#343a40">📰 Monitor DOU — ${date}</h2>

  <div style="display:flex;gap:16px;margin-bottom:20px">
    <div style="background:#d4edda;border-radius:8px;padding:12px 20px;text-align:center">
      <div style="font-size:28px;font-weight:bold;color:#155724">${found.length}</div>
      <div style="color:#155724">Publicado(s)</div>
    </div>
    <div style="background:#f8d7da;border-radius:8px;padding:12px 20px;text-align:center">
      <div style="font-size:28px;font-weight:bold;color:#721c24">${notFound.length}</div>
      <div style="color:#721c24">Não encontrado(s)</div>
    </div>
    ${errors.length > 0 ? `
    <div style="background:#fff3cd;border-radius:8px;padding:12px 20px;text-align:center">
      <div style="font-size:28px;font-weight:bold;color:#856404">${errors.length}</div>
      <div style="color:#856404">Erro(s)</div>
    </div>` : ''}
  </div>

  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#343a40;color:white">
        <th style="padding:10px 12px;text-align:left;border:1px solid #dee2e6">Processo</th>
        <th style="padding:10px 12px;text-align:left;border:1px solid #dee2e6">Status</th>
        <th style="padding:10px 12px;text-align:left;border:1px solid #dee2e6">Link</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p style="margin-top:20px;color:#6c757d;font-size:12px">
    Gerado automaticamente pelo Monitor DOU às ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
  </p>
</body>
</html>`;
}

function buildEmailText(date, results) {
  const lines = [`Monitor DOU - ${date}\n`];
  for (const r of results) {
    const status = r.error ? `ERRO: ${r.error}` : r.found ? 'PUBLICADO ✓' : 'Não encontrado';
    lines.push(`${r.processCode} → ${status}`);
  }
  return lines.join('\n');
}

async function sendEmail(date, results) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const found = results.filter(r => r.found);
  const subject =
    found.length > 0
      ? `✅ DOU ${date}: ${found.length} processo(s) publicado(s)!`
      : `❌ DOU ${date}: Nenhuma publicação encontrada`;

  await transporter.sendMail({
    from: `"Monitor DOU" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_TO,
    subject,
    html: buildEmailHtml(date, results),
    text: buildEmailText(date, results),
  });

  console.log(`📧 Email enviado para ${process.env.EMAIL_TO}`);
}

module.exports = { sendEmail };
