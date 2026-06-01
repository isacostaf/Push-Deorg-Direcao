//recognizeservice.js
/**
 * Service responsável por identificar o tipo de atividade
 * dentro do texto da publicação.
 */

/**
 * Normaliza texto:
 * - minúsculo
 * - remove acentos
 * - remove espaços duplicados
 */
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
};

/**
 * Dicionário de atividades com possíveis variações
 */
const ATIVIDADES = {
  camara: ["camara"],

  comissao: ["comissao"],

  comite: ["comite"],
  "comite executivo": ["comite executivo"],
  "comite gestor": ["comite gestor"],
  "comite tecnico": ["comite tecnico"],

  conselho: ["conselho", "consleho"],

  "grupo de assessoria especial": ["grupo de assessoria especial"],

  "grupo de trabalho": ["grupo de trabalho", "grupo d etrabalho"],
  "grupo de trabalho conjunto": ["grupo de trabalho conjunto"],
  "grupo de trabalho interministerio": ["grupo de trabalho interministerio"],
  "grupo de trabalho tecnico": [
    "grupo de trabalho tecnico",
    "grupo de trbalaho tecnico"
  ],

  "grupo especial": ["grupo especial"],
  "grupo tecnico": ["grupo tecnico", "grupo tencico"],
  "grupo temporario": ["grupo temporario"],

  subcomissao: ["subcomissao"],
  subcomite: ["subcomite"],

  subgrupo: ["subgrupo", "cubgrupo"]
};

/**
 * Ordena por tamanho da chave (prioriza termos mais específicos)
 */
const ATIVIDADES_ORDENADAS = Object.entries(ATIVIDADES).sort(
  (a, b) => b[0].length - a[0].length
);

/**
 * Identifica a atividade dentro de um texto
 */
function identificarAtividade(textoOriginal) {
  if (!textoOriginal) return "outro";

  // 🔥 opcional: limita análise ao começo do texto (evita lixo no final)
  const LIMITE_ANALISE = 800;
  const texto = normalizeText(textoOriginal).slice(0, LIMITE_ANALISE);

  let melhorMatch = {
    atividade: "outro",
    index: Infinity
  };

  for (const [atividade, variacoes] of ATIVIDADES_ORDENADAS) {
    for (const termo of variacoes) {
      // regex com borda de palavra pra evitar falso positivo
      const regex = new RegExp(`\\b${termo}\\b`, "g");
      const match = regex.exec(texto);

      if (match && match.index < melhorMatch.index) {
        melhorMatch = {
          atividade,
          index: match.index
        };
      }
    }
  }

  return melhorMatch.atividade;
}

module.exports = {
  identificarAtividade
};