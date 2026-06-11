const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { fetchAto } = require('./fetchAto');

function renderBlocoAto(r) {
  const ato = r.ato;

  const textoParas = (ato?.paragrafos || [])
    .map(p => `<p style="margin:0 0 10px;text-align:justify;">${p}</p>`)
    .join('');

  const atoUrl = r.atoUrl || (ato && ato.atoUrl);

  return `
    <div style="margin:24px 0;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;font-family:Arial,sans-serif;">
      <div style="background:#1a3d2e;padding:10px 18px;">
        <span style="color:#e8c872;font-weight:700;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">
          Processo: ${r.processCode}
        </span>
      </div>

      <div style="padding:20px 24px;font-size:14px;line-height:1.75;color:#1f2937;">
        ${ato?.identifica
          ? `<p style="font-weight:700;text-align:center;text-transform:uppercase;margin:0 0 10px;font-size:14px;">${ato.identifica}</p>`
          : ''}
        ${ato?.ementa
          ? `<p style="font-style:italic;color:#4b5563;margin:0 0 16px;text-align:center;font-size:13px;">${ato.ementa}</p>`
          : ''}

        ${textoParas}

        ${ato?.assina
          ? `<p style="font-weight:700;text-align:center;margin:16px 0 0;">${ato.assina}</p>`
          : ''}
      </div>

      ${atoUrl ? `
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:10px 18px;">
        <a href="${atoUrl}" target="_blank"
           style="color:#2d6a4f;font-size:12px;text-decoration:none;font-weight:600;">
          Ver publicação original no DOU →
        </a>
      </div>` : ''}
    </div>`;
}

function montarCorpoEmail(date, results) {
  const publicados = results.filter(r => r.found && !r.error);
  const total = results.length;
  const dataFormatada = date.replace(/-/g, '/');

  const blocosAtos = publicados.map(renderBlocoAto).join('');

  if (publicados.length === 0) {
    return `
      <div style="font-family:Arial,sans-serif;color:#112b32;line-height:1.6;max-width:680px;">
        <img src="cid:email-logo" style="width:100%;max-width:680px;display:block;margin-bottom:20px;" alt="" />
        <p>Prezada Sra. Diretora Erika,</p>
        <p>
          Informamos que a busca autônoma no <strong>Diário Oficial da União</strong>
          realizada em <strong>${dataFormatada}</strong> verificou
          <strong>${total} processos</strong> e não identificou publicações.
        </p>
        <p>Esta busca foi realizada de maneira autônoma e não substitui uma pesquisa detalhada no Diário Oficial.</p>
      </div>`;
  }

  if (publicados.length === 1) {
  return `
    <div style="font-family:Arial,sans-serif;color:#112b32;line-height:1.6;max-width:680px;">
      <img src="cid:email-logo" style="width:100%;max-width:680px;display:block;margin-bottom:20px;" alt="" />
      <p>Prezada Sra. Diretora Erika,</p>
      <p>
        Informamos que a busca autônoma no <strong>Diário Oficial da União</strong>
        realizada em <strong>${dataFormatada}</strong> identificou
        <strong style="color:#166534;">${publicados.length}</strong> publicação
        em um total de <strong>${total}</strong> processos verificados:
      </p>

      ${blocosAtos}

      <p style="font-size:13px;color:#6b7280;margin-top:24px;">
        Esta busca foi realizada de maneira autônoma e não substitui uma pesquisa detalhada no Diário Oficial.
      </p>
    </div>`;
  }

  return `
    <div style="font-family:Arial,sans-serif;color:#112b32;line-height:1.6;max-width:680px;">
      <img src="cid:email-logo" style="width:100%;max-width:680px;display:block;margin-bottom:20px;" alt="" />
      <p>Prezada Sra. Diretora Erika,</p>
      <p>
        Informamos que a busca autônoma no <strong>Diário Oficial da União</strong>
        realizada em <strong>${dataFormatada}</strong> identificou
        <strong style="color:#166534;">${publicados.length}</strong> publicações
        em um total de <strong>${total}</strong> processos verificados:
      </p>

      ${blocosAtos}

      <p style="font-size:13px;color:#6b7280;margin-top:24px;">
        Esta busca foi realizada de maneira autônoma e não substitui uma pesquisa detalhada no Diário Oficial.
      </p>
    </div>`;
}

async function enriquecerComAto(results) {
  return Promise.all(
    results.map(async (r) => {
      if (!r.found || !r.atoUrl) return r;
      try {
        const ato = await fetchAto(r.atoUrl);
        return { ...r, ato };
      } catch {
        return r;
      }
    })
  );
}

async function configurarEnvioEmail() {
  const smtpHost     = process.env.SMTP_HOST;
  const smtpPort     = Number(process.env.SMTP_PORT || 0);
  const smtpUser     = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom    = process.env.EMAIL_FROM || smtpUser;

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
    auth: { user: smtpUser, pass: smtpPassword },
  });

  return { transporter, emailFrom, destinatarios };
}

async function enviarEmail({ date, results }) {
  const { transporter, emailFrom, destinatarios } = await configurarEnvioEmail();

  const dataFormatada = date.replace(/-/g, '/');

  const resultadosComAto = await enriquecerComAto(results);

  const logoPath  = path.join(__dirname, '..', 'public', 'email.png');
  const attachments = fs.existsSync(logoPath)
    ? [{ filename: 'email.png', path: logoPath, cid: 'email-logo' }]
    : [];

  await transporter.sendMail({
    from: emailFrom,
    to: destinatarios.join(', '),
    subject: `Monitor DOU - ${dataFormatada}`,
    html: montarCorpoEmail(date, resultadosComAto),
    attachments,
  });
}

module.exports = { enviarEmail, montarCorpoEmail };
