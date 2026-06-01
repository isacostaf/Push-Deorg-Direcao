function normalizarTexto(texto) {
  return (texto || "")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairFinalidade(texto) {
  const t = normalizarTexto(texto);
  const tLower = t.toLowerCase();

  ////////////////////////////////////////////////////////
  // 🔥 1. TENTA ART. 2º (PRIORIDADE)
  ////////////////////////////////////////////////////////

  const match = t.match(/Art\.\s*2º([\s\S]*?)(?=Art\.\s*\d+º|$)/i);

  if (match) {
    const bloco = match[1];
    const blocoLower = bloco.toLowerCase();

    // ✅ palavras que indicam FINALIDADE REAL
    const palavrasChave = [
      "compete",
      "finalidade",
      "objetivo",
      "atribui",
      "incumbe"
    ];

    // ❌ palavras que indicam LISTA (falso positivo)
    const palavrasBloqueio = [
      "designa",
      "designados",
      "representantes",
      "titular",
      "suplente",
      "nomeia",
      "indica"
    ];

    const temIndicador = palavrasChave.some(p =>
      blocoLower.includes(p)
    );

    const temBloqueio = palavrasBloqueio.some(p =>
      blocoLower.includes(p)
    );

    // 🔥 só aceita se for realmente finalidade
    if (temIndicador && !temBloqueio) {
      const itens = [...bloco.matchAll(/([IVXLCDM]+)\s*-\s*([^;]+[;.]?)/gi)];

      if (itens.length > 0) {
        return itens
          .map(m => `${m[1]} - ${m[2].trim()}`)
          .join(" ");
      }

      // fallback: pega texto corrido do artigo
      return bloco.trim();
    }
  }

  ////////////////////////////////////////////////////////
  // 🔥 2. FALLBACK: BUSCA NO TEXTO TODO
  ////////////////////////////////////////////////////////

  const regexFinalidade = [
    /tem por finalidade\s+(.*?)(?=\.|;)/i,
    /tem como finalidade\s+(.*?)(?=\.|;)/i,
    /tem por objetivo\s+(.*?)(?=\.|;)/i,
    /com o objetivo de\s+(.*?)(?=\.|;)/i,
    /com a finalidade de\s+(.*?)(?=\.|;)/i,
  ];

  for (const regex of regexFinalidade) {
    const match = t.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  ////////////////////////////////////////////////////////
  // 🔥 3. NÃO ENCONTROU NADA
  ////////////////////////////////////////////////////////

  return "";
}

module.exports = {
  extrairFinalidade,
};