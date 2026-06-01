const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const axios = require("axios");
const cheerio = require("cheerio");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { safeFileName } = require("../utils/storage");

function wrapText(text, font, fontSize, maxWidth) {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);

    if (candidateWidth <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

async function gerarPdfBuffer(url, titulo) {
  const response = await axios.get(url, {
    timeout: 60000,
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  const html = String(response.data || "");
  const $ = cheerio.load(html);

  const paragrafos = [];
  $(".dou-paragraph").each((_, el) => {
    const t = String($(el).text() || "").replace(/\s+/g, " ").trim();
    if (t) paragrafos.push(t);
  });

  const texto = paragrafos.join("\n\n").trim() || "Conteúdo indisponível.";

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize = { width: 595.28, height: 841.89 };
  const margin = 54;
  const contentWidth = pageSize.width - margin * 2;

  const titleFontSize = 16;
  const bodyFontSize = 11;
  const lineHeight = 14;

  let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - margin;

  const title = String(titulo || "").trim() || "Documento";
  const titleLines = wrapText(title, fontBold, titleFontSize, contentWidth);

  for (const line of titleLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: titleFontSize,
      font: fontBold,
      color: rgb(0.07, 0.17, 0.2),
    });
    y -= titleFontSize + 4;
  }

  y -= 8;

  const blocks = texto.split("\n\n").map((b) => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const lines = wrapText(block, font, bodyFontSize, contentWidth);
    for (const line of lines) {
      if (y <= margin + lineHeight) {
        page = pdfDoc.addPage([pageSize.width, pageSize.height]);
        y = pageSize.height - margin;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: bodyFontSize,
        font,
        color: rgb(0.07, 0.17, 0.2),
      });
      y -= lineHeight;
    }

    y -= lineHeight;
  }

  return Buffer.from(await pdfDoc.save());
}

async function baixarPdfs(rows, dirs) {
  for (const row of rows) {
    const nomeBase = safeFileName(row.Documento);
    const url = String(row.PDF || "").trim();
    const classificacao = String(row.Classificacao || "").toLowerCase();

    const dirDestino = classificacao === "alta probabilidade"
      ? dirs.altaDir
      : classificacao === "baixa probabilidade"
        ? dirs.baixaDir
        : null;

    if (!dirDestino || !url) {
      continue;
    }

    let destino = path.join(dirDestino, `${nomeBase}.pdf`);
    let idx = 1;
    while (fs.existsSync(destino)) {
      destino = path.join(dirDestino, `${nomeBase}_${idx}.pdf`);
      idx += 1;
    }

    try {
      const pdfBuffer = await gerarPdfBuffer(url, row.Documento);
      fs.writeFileSync(destino, pdfBuffer);
    } catch (error) {
      // Ignora falhas individuais para manter o processamento resiliente.
    }
  }
}

function criarZipBuffer(dirPath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (data) => chunks.push(data));
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") return;
      reject(err);
    });
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    archive.directory(dirPath, false);
    archive.finalize();
  });
}

module.exports = {
  baixarPdfs,
  criarZipBuffer,
};