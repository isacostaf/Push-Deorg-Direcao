function normalizarTexto(texto) {
  return (texto || "")
    .replace(/\r/g, "")
    .trim();
}

/**
 * Isola blocos militares relevantes:
 * - Ministério da Defesa
 * - Comando do Exército
 * - Comando da Marinha
 * - Comando da Aeronáutica
 */
function extrairBlocoMilitar(texto) {
  const regex =
    /(Minist[ée]rio da Defesa|Comando do Ex[ée]rcito|Comando da Marinha|Comando da Aeron[aá]utica)[\s\S]*?(?=Minist[ée]rio|Comando|Art\.|II -|$)/gi;

  const matches = [...texto.matchAll(regex)];

  return matches.map(m => m[0]).join("\n\n");
}

/**
 * Limpa apenas espaços excessivos, mas NÃO destrói estrutura
 */
function limparLinhas(texto) {
  return texto
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

/**
 * Mantém só linhas relevantes (titular / suplente)
 */
function extrairRepresentantesMilitares(texto) {
  const t = normalizarTexto(texto);

  const bloco = extrairBlocoMilitar(t);
  if (!bloco) return "";

  const linhas = limparLinhas(bloco);

  const resultado = [];

  for (const linha of linhas) {
    const l = linha.toLowerCase();

    // pega titulares e suplentes em qualquer formato
    if (l.includes("titular") || l.includes("suplente")) {
      resultado.push(linha);
    }
  }

  return resultado.join(" ");
}

module.exports = {
  extrairRepresentantesDefesa: extrairRepresentantesMilitares,
};