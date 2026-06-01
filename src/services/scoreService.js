const PALAVRAS_BLOQUEIO = ["cesportos"];

const PALAVRAS_OBRIGATORIAS = ["ministerio da defesa"];

const PESOS_POSITIVOS = {
  "fica instituido": 7,
  "sera composto": 7,
  "designar os seguintes membros": 7,
  "alterar designacoes": 7,
  "designar como membros": 7,
  "para compor": 2,
  "comite": 1,
  comissao: 1,
  conselho: 1,
  "grupo de trabalho": 1,
  "grupo de assessoramento": 1,
  "grupo de assessoria": 1,
  "grupo conjunto": 1,
  "grupo especial": 1,
  "grupo tecnico": 1,
  subcomissao: 1,
  subcomite: 1,
  subgrupo: 1,
  designados: 1,
  designado: 1,
  nomeados: 1,
  nomeado: 1,
  indicados: 1,
  indicado: 1,
  membro: 1,
  representante: 1,
  representantes: 1,
};

const PESOS_NEGATIVOS = {
  incluir: 1,
  incluido: 1,
  incluida: 1,
  substitui: 1,
  substituido: 1,
  substituida: 1,
  excluir: 1,
  excluido: 1,
  excluida: 1,
  regulamenta: 1,
  institui: 1,
  estabelece: 1,
  disposicoes: 1,
  resolucao: 1,
  licitacao: 1,
};

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectarRepresentacao(textoOriginal) {
  const texto = normalizeText(textoOriginal);

  const temDesignar =
    texto.includes("ficam designados") ||
    texto.includes("designar") ||
    texto.includes("alterar designacoes");

  const temRepresentante =
    texto.includes("representante") ||
    texto.includes("representantes") ||
    texto.includes("membros") ||
    texto.includes("titulares");

  if (
    texto.includes("representantes dos seguintes orgaos") ||
    texto.includes("para comporem")
  ) {
    return 10;
  }

  if (temDesignar && temRepresentante) {
    return 8;
  }

  return 0;
}

function temBloqueio(textoOriginal) {
  const texto = normalizeText(textoOriginal);
  return PALAVRAS_BLOQUEIO.some((palavra) => texto.includes(palavra));
}

function temObrigatorio(textoOriginal) {
  const texto = normalizeText(textoOriginal);
  return PALAVRAS_OBRIGATORIAS.every((palavra) => texto.includes(palavra));
}

function calcularScore(textoOriginal) {
  const texto = normalizeText(textoOriginal);

  const scorePos = Object.entries(PESOS_POSITIVOS)
    .filter(([palavra]) => texto.includes(palavra))
    .reduce((acc, [, peso]) => acc + peso, 0);

  const scoreNeg = Object.entries(PESOS_NEGATIVOS)
    .filter(([palavra]) => texto.includes(palavra))
    .reduce((acc, [, peso]) => acc + peso, 0);

  const scoreBase = scorePos - scoreNeg;
  const scoreRepresentacao = detectarRepresentacao(texto);

  return {
    scoreBase,
    scoreRepresentacao,
    bloqueado: temBloqueio(texto),
    obrigatorio: temObrigatorio(texto),
    positivas: Object.keys(PESOS_POSITIVOS).filter((palavra) => texto.includes(palavra)),
    negativas: Object.keys(PESOS_NEGATIVOS).filter((palavra) => texto.includes(palavra)),
  };
}

module.exports = {
  normalizeText,
  calcularScore,
  temObrigatorio,
};
