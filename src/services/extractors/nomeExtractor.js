function extrairNome(textoOriginal) {
  if (!textoOriginal) return "";

  const trecho = textoOriginal.slice(0, 1500);

  const regex =
    /\b(o|a)?\s*(Comitê|Comite|Comissão|Comissao|Conselho|Grupo de Trabalho)[^.;\n]+/i;

  const match = trecho.match(regex);

  if (!match) return "";

  let nome = match[0];

  const cortes = [
    ", no âmbito",
    ", no ambito",
    ", no âmbito do",
    ", no ambito do",
    ", com a finalidade",
    ", com o objetivo",
    ", com objetivo",
    ", com a atribuicao",
    ", com atribuicao",
    ", indicados",
    ":",
    " I -",
    " II -",
    " III -",
  ];

  for (const corte of cortes) {
    const idx = nome.toLowerCase().indexOf(corte);
    if (idx !== -1) {
      nome = nome.slice(0, idx);
    }
  }

  return limparNome(nome);
}

function limparNome(nome) {
  return nome
    .replace(/^(o|a)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/,$/, "")
    .replace(/\.$/, "");
}

module.exports = {
  extrairNome,
};