function normalizarTexto(texto) {
  return (texto || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ") // 🔥 deixa tudo linear mesmo
    .trim();
}

/**
 * encontra início do bloco
 */
function encontrarInicio(texto) {
  const regex =
    /(integrada por um representante de cada órgão arrolado a seguir|composta por.*seguintes órgãos|indicados pelos seguintes órgãos|órgãos arrolados a seguir)/i;

  const match = texto.match(regex);
  return match ? match.index : -1;
}

/**
 * 🔥 corta corretamente mesmo sem \n
 */
function encontrarFim(texto, startIndex) {
  const recorte = texto.slice(startIndex);

  const match = recorte.match(/(\s§\s*\d+º|\sArt\.)/i);

  if (!match) return texto.length;

  return startIndex + match.index;
}

/**
 * extrai órgãos componentes
 */
function extrairOrgaosComponentes(texto) {
  const t = normalizarTexto(texto);

  const inicio = encontrarInicio(t);
  if (inicio === -1) return "";

  const fim = encontrarFim(t, inicio);

  let bloco = t.slice(inicio, fim);

  // remove frase inicial
  bloco = bloco.replace(
    /(integrada por um representante de cada órgão arrolado a seguir:?\s*)/i,
    ""
  );

  return bloco.trim();
}

module.exports = {
  extrairOrgaosComponentes,
};