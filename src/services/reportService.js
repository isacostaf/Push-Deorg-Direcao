//reportservice.js
// 
const fs = require("fs");
const { Parser } = require("json2csv");

function classificar(row) {
  const scoreBase = Number(row["Score Base"] || 0);
  const scoreRep = Number(row["Score Representacao"] || 0);
  const bloqueado = row["Bloqueado"] === true || row["Bloqueado"] === "true";

  // Alta probabilidade: scoreRep >= 8, não bloqueado, scoreBase > -1
  if (scoreRep >= 8 && !bloqueado && scoreBase > -1) {
    return "Alta probabilidade";
  }
  // Baixa probabilidade: scoreBase > 2 ou scoreRep >= 8 (mas não Alta probabilidade)
  if (scoreBase > 2 || scoreRep >= 8) {
    return "Baixa probabilidade";
  }
  return "Extra-Baixa probabilidade";
}

function gerarRelatorio(resumo) {
  return (resumo || [])
    .filter((row) => row.Obrigatorio === true || row.Obrigatorio === "true")
    .map((row) => ({
      Documento: row.Documento,
      PDF: row.PDF,
      Classificacao: classificar(row),
      "Score Base": row["Score Base"],
      "Score Representacao": row["Score Representacao"],
    }))
    .filter(
      (row) =>
        row.Classificacao === "Alta probabilidade" ||
        row.Classificacao === "Baixa probabilidade"
    );
}

function gerarCsvDownload(resumo) {
  return (resumo || [])
    .map((row) => ({
      Documento: row.Documento,
      PDF: row.PDF,
      Classificacao: classificar(row),
      "Score Base": row["Score Base"],
      "Score Representacao": row["Score Representacao"],
    }));
}

function salvarCsv(caminho, csvRows) {
  const campos = ["Documento", "PDF", "Classificacao"];
  const parser = new Parser({ fields: campos });

  const conteudo =
    csvRows && csvRows.length > 0
      ? parser.parse(csvRows)
      : `${campos.join(",")}\n`;

  fs.writeFileSync(caminho, conteudo, "utf8");
  return conteudo;
}

module.exports = {
  gerarRelatorio,
  gerarCsvDownload,
  salvarCsv,
  classificar, // 👈 EXPORTA ISSO
};