/**
 * Extrai a ação principal do documento
 */

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extrairTipoColegiado(textoOriginal) {
  if (!textoOriginal) return "outro";

  // 🔥 só começo do texto (onde está a ação)
  const texto = normalize(textoOriginal).slice(0, 800);

  const temInstitui =
    texto.includes("fica instituido") ||
    texto.includes("institui") ||
    texto.includes("fica criado");

const temDispensa =
    texto.includes("dispensa") ||
    texto.includes("dispensados") ||
    texto.includes("ficam dispensados");

  const temDesigna =
    texto.includes("designar") ||
    texto.includes("designados") ||
    texto.includes("ficam designados") ||
    texto.includes("nomear") ||
    texto.includes("nomeados");

  const temAltera =
    texto.includes("altera") ||
    texto.includes("alterar") ||
    texto.includes("modifica");

  const temProrroga =
    texto.includes("prorroga") ||
    texto.includes("prorrogado") ||
    texto.includes("prorrogacao");

  // 🔥 prioridade importa aqui

    // 🔥 caso especial permitido
    if (temInstitui && temDesigna &&
    !temAltera && !temProrroga && !temDispensa) {
    return "institui e designa";
    }

    // 🔥 múltiplas ações (não permitido)
    if (
    (temInstitui && (temAltera || temProrroga || temDispensa)) ||
    (temDesigna && (temAltera || temProrroga || temDispensa)) ||
    (temAltera && (temProrroga || temDispensa)) ||
    (temProrroga && temDispensa)
    ) {
    return "Possui mais que uma ação";
    }

    // 🔥 casos simples
    if (temInstitui) return "institui";
    if (temDesigna) return "designa";
    if (temAltera) return "altera";
    if (temProrroga) return "prorroga";
    if (temDispensa) return "dispensa";

    return "outro";
}

module.exports = {
    extrairTipoColegiado,
};