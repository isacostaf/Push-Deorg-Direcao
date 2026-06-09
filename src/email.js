const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function montarCorpoEmail(date, results) {
  const publicados = results.filter(r => r.found && !r.error);
  const naoEncontrados = results.filter(r => !r.found && !r.error);
  const comErro = results.filter(r => r.error);

  const total = results.length;
  const dataFormatada = date.replace(/-/g, '/');

  const renderLinha = (r) => {
    let cor, status;

    if (r.error) {
      cor = '#b45309';
      status = `Erro: ${r.error}`;
    } else if (r.found) {
      cor = '#166534';
      status = 'Publicado';
    } else {
      cor = '#991b1b';
      status = 'Não encontrado';
    }

    const processo = r.url
      ? `<a href="${r.url}" target="_blank" style="color:#0004ff;text-decoration:underline;">${r.processCode}</a>`
      : r.processCode;

    return `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${processo}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;color:${cor};font-weight:600;">${status}</td>
      </tr>`;
  };

  const linhaTabela = results.map(renderLinha).join('');

  const linhaErro = comErro.length
    ? `<li><strong style="color:#b45309;">${comErro.length}</strong> com erro</li>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;color:#112b32;line-height:1.6;max-width:680px;">
      <p>Prezado(a),</p>
      <p>
        Informamos que a busca autônoma no <strong>Diário Oficial da União</strong>
        realizada em <strong>${dataFormatada}</strong> verificou
        <strong>${total} processo(s)</strong>, com o seguinte resultado:
      </p>
      <ul style="margin:0 0 16px;">
        <li><strong style="color:#166534;">${publicados.length}</strong> publicado(s)</li>
        <li><strong style="color:#991b1b;">${naoEncontrados.length}</strong> não encontrado(s)</li>
        ${linhaErro}
      </ul>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Processo</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #d1d5db;">Status</th>
          </tr>
        </thead>
        <tbody>${linhaTabela}</tbody>
      </table>
      <p>Em anexo, segue a tabela com os resultados em formato .CSV.</p>
      <p>Esta busca foi realizada de maneira autônoma e não substitui uma pesquisa detalhada no Diário Oficial.</p>
    </div>`;
}

async function configurarEnvioEmail() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 0);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM || smtpUser;

  const destinatarios = (process.env.EMAIL_TO || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !destinatarios.length) {
    throw new Error('Configuração SMTP incompleta ou sem destinatários.');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  return { transporter, emailFrom, destinatarios };
}

async function enviarEmail({ date, results, csvPath, csvContent }) {
  const { transporter, emailFrom, destinatarios } = await configurarEnvioEmail();

  const dataFormatada = date.replace(/-/g, '/');

  const anexos = [];
  if (csvContent) {
    anexos.push({ filename: `processos_resultado_${date}.csv`, content: Buffer.from(csvContent, 'utf8') });
  } else if (csvPath && fs.existsSync(csvPath)) {
    anexos.push({ filename: path.basename(csvPath), path: csvPath });
  }

  await transporter.sendMail({
    from: emailFrom,
    to: destinatarios.join(', '),
    subject: `Monitor DOU - ${dataFormatada}`,
    html: montarCorpoEmail(date, results),
    attachments: anexos,
  });
}

module.exports = { enviarEmail, montarCorpoEmail };
