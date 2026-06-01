const fs = require("fs");
const os = require("os");
const path = require("path");
const nodemailer = require("nodemailer");
const sharp = require("sharp");
const supabase = require("../config/supabase");
const { ensureDir } = require("../utils/storage");

async function listarDestinatarios() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("email");

  if (error) throw error;

  return (data || [])
    .map((item) => (item.email || "").trim())
    .filter(Boolean);
}

async function getEmailConfig() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 0);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM || smtpUser;
  const destinatarios = await listarDestinatarios();

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !destinatarios.length) {
    throw new Error("Configuracao SMTP incompleta ou sem destinatarios.");
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

  return {
    transporter,
    emailFrom,
    destinatarios,
  };
}

function montarCorpoEmail(periodoLabel) {
  const linhas = [];
  if (periodoLabel) {
    linhas.push(`Periodo processado: ${periodoLabel}`);
    linhas.push("");
  }

  linhas.push(
    "Acesse o sistema: https://radarcolegiados.vercel.app/",
    "Ministerio da defesa",
    "SEORI/DEORG/COPAR",
  );
  return linhas.join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function quebrarLinhas(texto, maxChars) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";

  for (const palavra of palavras) {
    const candidato = atual ? `${atual} ${palavra}` : palavra;
    if (candidato.length > maxChars && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidato;
    }
  }

  if (atual) {
    linhas.push(atual);
  }

  return linhas;
}

function carregarFontesSvg() {
  const fontsDir = path.join(__dirname, "..", "..", "public", "fonts");
  const regularPath = path.join(fontsDir, "OpenSauceOne-Regular.ttf");
  const boldPath = path.join(fontsDir, "OpenSauceOne-Bold.ttf");

  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    return "";
  }

  const regularBase64 = fs.readFileSync(regularPath).toString("base64");
  const boldBase64 = fs.readFileSync(boldPath).toString("base64");

  return `
    <style>
      @font-face {
        font-family: "OpenSauceOne";
        src: url("data:font/ttf;base64,${regularBase64}") format("truetype");
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: "OpenSauceOne";
        src: url("data:font/ttf;base64,${boldBase64}") format("truetype");
        font-weight: 700;
        font-style: normal;
      }
    </style>
  `;
}

function montarLinhasImagem(alta, talvez, periodoLabel) {
  const total = alta.length + talvez.length;
  const data = new Date().toLocaleDateString("pt-BR");
  const referencia = periodoLabel
    ? `no periodo ${periodoLabel}`
    : `no dia de hoje (${data})`;

  let textoAnexo = "Em anexo, seguem os arquivos referentes aos atos e a tabela, em formato .CSV, dos colegiados encontrados.";
  let incluirListas = true;

  if (!alta.length && !talvez.length) {
    textoAnexo = "Em anexo, segue a tabela em formato .CSV contendo os resultados encontrados na consulta.";
    incluirListas = false;
  } else if ((alta.length === 1 && talvez.length === 0) || (alta.length === 0 && talvez.length === 1)) {
    textoAnexo = "Em anexo, segue o arquivo referente ao ato e a tabela, em .CSV, do colegiado encontrado.";
  }

  const linhas = [
    { text: "Prezado(a),", bold: false },
    { text: "", bold: false },
    { text: `Informamos que a busca autônoma identificou ${total} colegiados na consulta realizada ${referencia}.`, bold: false },
    { text: "", bold: false },
    { text: textoAnexo, bold: false },
  ];

  if (incluirListas) {
    const listaAlta = alta.length ? alta : ["Não há colegiados nesta categoria."];
    const listaTalvez = talvez.length ? talvez : ["Não há colegiados nesta categoria."];

    linhas.push(
      { text: "", bold: false },
      { text: "Colegiados encontrados:", bold: true },
      { text: "", bold: false },
      { text: "Alta probabilidade:", bold: true },
      ...listaAlta.map((item) => ({ text: item, bold: false })),
      { text: "", bold: false },
      { text: "Baixa probabilidade:", bold: true },
      ...listaTalvez.map((item) => ({ text: item, bold: false }))
    );
  }

  linhas.push(
    { text: "", bold: false },
    { text: "Ressaltamos que essa busca foi realizada de maneira autônoma e não substitui uma pesquisa detalhada no Diário Oficial da União.", bold: false }
  );

  return linhas;
}

async function gerarImagemEmail({ alta, talvez, outputPath, periodoLabel }) {
  const fontsDir = path.join(__dirname, "..", "..", "public", "fonts");
  const fontConfigPath = path.join(fontsDir, "fonts.conf");
  if (fs.existsSync(fontConfigPath)) {
    process.env.FONTCONFIG_PATH = fontsDir;
    process.env.FONTCONFIG_FILE = fontConfigPath;
  }

  const headerImagePath = path.join(__dirname, "..", "..", "public", "email.png");
  const baseImage = sharp(headerImagePath);
  const metadata = await baseImage.metadata();

  const width = metadata.width || 1200;
  const height = metadata.height || 800;
  const headerHeight = Math.round(height * 0.23);
  const paddingX = Math.round(width * 0.06);
  const fontSize = Math.max(18, Math.min(30, Math.round(width * 0.014)));
  const lineHeight = Math.round(fontSize * 1.5);
  const maxChars = Math.max(24, Math.floor((width - paddingX * 2) / (fontSize * 0.55)));

  const baseLines = montarLinhasImagem(alta, talvez, periodoLabel);
  const textLines = baseLines.flatMap((item) => {
    if (!item.text) {
      return [{ text: "", bold: false }];
    }

    return quebrarLinhas(item.text, maxChars).map((line) => ({ text: line, bold: item.bold }));
  });

  const startY = headerHeight + Math.round(fontSize * 1.4);
  const maxLines = Math.floor((height - startY - fontSize * 1.2) / lineHeight);
  const visibleLines = textLines.slice(0, Math.max(0, maxLines));

  const tspanMarkup = visibleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      const weight = line.bold ? 700 : 400;
      const content = escapeXml(line.text || " ");
      return `<tspan x="${paddingX}" dy="${dy}" font-weight="${weight}">${content}</tspan>`;
    })
    .join("");

  const overlaySvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${carregarFontesSvg()}
      <rect x="0" y="${headerHeight}" width="${width}" height="${height - headerHeight}" fill="#ffffff" />
      <text x="${paddingX}" y="${startY}" fill="#4c4c4c" font-family="OpenSauceOne, Arial, Helvetica, sans-serif" font-size="${fontSize}" letter-spacing="0.2">
        ${tspanMarkup}
      </text>
    </svg>
  `;

  await baseImage
    .composite([{ input: Buffer.from(overlaySvg) }])
    .png()
    .toFile(outputPath);

  return outputPath;
}

function montarHtmlEmail() {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Radar Colegiados</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f6f8;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f6f8; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width: 640px; width: 100%; background-color: #ffffff;">
                <tr>
                  <td>
                    <img src="cid:email-header" alt="Radar Colegiados - MD" style="display: block; width: 100%; height: auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 28px 28px; font-family: Arial, Helvetica, sans-serif; color: #4c4c4c; font-size: 16px; line-height: 1.5;">
                    <p style="margin: 0 0 6px;">Acesse o sistema https://radarcolegiados.vercel.app/</p>
                    <p style="margin: 0 0 6px;">Ministerio da defesa</p>
                    <p style="margin: 0;">SEORI/DEORG/COPAR</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function listarPdfsParaAnexo(pdfBase) {
  if (!fs.existsSync(pdfBase)) {
    return [];
  }

  const stack = [pdfBase];
  const files = [];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function montarAssunto(periodoLabel) {
  if (periodoLabel) {
    return `Colegiados - ${periodoLabel}`;
  }

  return `Colegiados ${new Date().toLocaleDateString("pt-BR")}`;
}

async function enviarEmail({ csvPath, pdfBase, linhas, periodoLabel }) {
  const { transporter, emailFrom, destinatarios } = await getEmailConfig();

  const alta = linhas.filter((l) => l.Classificacao === "Alta probabilidade").map((l) => l.Documento);
  const talvez = linhas.filter((l) => l.Classificacao === "Baixa probabilidade").map((l) => l.Documento);

  const anexos = [];
  const headerImagePath = path.join(path.dirname(csvPath), "email-gerado.png");
  await gerarImagemEmail({
    alta,
    talvez,
    outputPath: headerImagePath,
    periodoLabel,
  });
  if (fs.existsSync(headerImagePath)) {
    anexos.push({ filename: "email.png", path: headerImagePath, cid: "email-header" });
  }
  if (fs.existsSync(csvPath)) {
    anexos.push({ filename: path.basename(csvPath), path: csvPath });
  }

  for (const pdfPath of listarPdfsParaAnexo(pdfBase)) {
    anexos.push({ filename: path.basename(pdfPath), path: pdfPath });
  }

  await transporter.sendMail({
    from: emailFrom,
    to: destinatarios.join(", "),
    subject: montarAssunto(periodoLabel),
    text: montarCorpoEmail(periodoLabel),
    html: montarHtmlEmail(),
    attachments: anexos,
  });
}

async function enviarEmailAcumulado({ itens, periodoLabel }) {
  const { transporter, emailFrom, destinatarios } = await getEmailConfig();

  const todasLinhas = (itens || [])
    .flatMap((item) => Array.isArray(item.linhas) ? item.linhas : []);

  const alta = todasLinhas
    .filter((l) => l.Classificacao === "Alta probabilidade")
    .map((l) => l.Documento);
  const talvez = todasLinhas
    .filter((l) => l.Classificacao === "Baixa probabilidade")
    .map((l) => l.Documento);

  const anexos = [];
  const baseDir = path.join(os.tmpdir(), "representacoes-aa", "email-acumulado");
  ensureDir(baseDir);
  const headerImagePath = path.join(baseDir, "email-gerado.png");

  await gerarImagemEmail({
    alta,
    talvez,
    outputPath: headerImagePath,
    periodoLabel,
  });

  if (fs.existsSync(headerImagePath)) {
    anexos.push({ filename: "email.png", path: headerImagePath, cid: "email-header" });
  }

  for (const item of itens || []) {
    const dataLabel = String(item.data || "").trim();

    if (item.csvPath && fs.existsSync(item.csvPath)) {
      const baseName = dataLabel ? `relatorio-${dataLabel}.csv` : path.basename(item.csvPath);
      anexos.push({ filename: baseName, path: item.csvPath });
    }

    for (const pdfPath of listarPdfsParaAnexo(item.pdfBase)) {
      const fileName = dataLabel
        ? `${dataLabel}-${path.basename(pdfPath)}`
        : path.basename(pdfPath);
      anexos.push({ filename: fileName, path: pdfPath });
    }
  }

  await transporter.sendMail({
    from: emailFrom,
    to: destinatarios.join(", "),
    subject: montarAssunto(periodoLabel),
    text: montarCorpoEmail(periodoLabel),
    html: montarHtmlEmail(),
    attachments: anexos,
  });
}

module.exports = {
  enviarEmail,
  enviarEmailAcumulado,
};

