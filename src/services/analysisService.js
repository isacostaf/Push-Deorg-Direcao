require("dotenv").config();

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const { calcularScore, temObrigatorio } = require("./scoreService");
const { coletarLinksPaginados } = require("./searchService");
const { classificar } = require("./reportService");

////////////////////////////////////////////////
// 3
const {
  identificarAtividade,
  extrairNome,
  extrairTipoColegiado,
  extrairRepresentantesDefesa,
  extrairOrgaosComponentes,
  extrairFinalidade,
} = require("./extractors");

/**
 * Scraping rápido
 */
async function pegarTextoFast(url) {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(response.data);

    const paragrafos = [];
    $(".dou-paragraph").each((_, el) => {
      paragrafos.push($(el).text());
    });

    const cabecalho = $(".orgao-dou-data").text() || "";

    return {
      corpo: paragrafos.join(" "),
      cabecalho,
    };
  } catch (error) {
    console.error("Erro ao buscar texto:", url);
    return {
      corpo: "",
      cabecalho: "",
    };
  }
}

/**
 * Processa link
 */
async function processarLink(item) {
  const texto = await pegarTextoFast(item.href);
  const conteudoCompleto = `${texto.corpo} ${texto.cabecalho}`;

  const score = calcularScore(conteudoCompleto);
  const obrigatorio = temObrigatorio(conteudoCompleto);

  const classificacao = classificar({
    "Score Base": score.scoreBase,
    "Score Representacao": score.scoreRepresentacao,
    Bloqueado: score.bloqueado,
  });

  const passaFiltro =
    (obrigatorio === true || obrigatorio === "true") &&
    (classificacao === "Alta probabilidade" ||
      classificacao === "Baixa probabilidade");

////////////////////////////////////////////////
// 4
  let atividade = "outro";
  let nome = "";
  let tipoColegiado = "outro";
  let representantes = "";
  let orgaosComponentes = "";
  let finalidade = "";

////////////////////////////////////////////////
// 5
  if (passaFiltro) {
    atividade = identificarAtividade(conteudoCompleto);
    nome = extrairNome(conteudoCompleto);
    tipoColegiado = extrairTipoColegiado(conteudoCompleto);
    representantes = extrairRepresentantesDefesa(conteudoCompleto);
    orgaosComponentes = extrairOrgaosComponentes(conteudoCompleto);
    finalidade = extrairFinalidade(conteudoCompleto);
  }

////////////////////////////////////////////////
// 6
  return {
    Documento: item.titulo,
    Nome: nome,
    Atividade: atividade,
    TipoColegiado: tipoColegiado,
    Representantes: representantes,
    Orgaos_Componentes: orgaosComponentes,
    Finalidade: finalidade,
    PDF: item.href,
    "Score Base": score.scoreBase,
    "Score Representacao": score.scoreRepresentacao,
    "Palavras positivas": score.positivas.join(", "),
    "Palavras negativas": score.negativas.join(", "),
    Bloqueado: score.bloqueado,
    Obrigatorio: obrigatorio,
    _passaFiltro: passaFiltro,
  };
}

/**
 * 🔥 SANITIZAÇÃO CSV (PROTEGE ; e QUEBRA DE LINHA)
 */
function safe(value) {
  return (value || "")
    .toString()
    .replace(/;/g, ",")   // evita quebrar colunas
    .replace(/\n/g, " ")  // evita quebrar linha do CSV
    .replace(/\r/g, " ")
    .trim();
}

/**
 * CSV na raiz com schema fixo
 */
function gerarCsvNaRaiz(dados) {
  const COLUNAS = [
    "Controle",
    "ID",
    "Data",
    "Hora",
    "Usuario",
    "Documento",
    "TipoColegiado",
    "Setor",
    "Atividade",
    "Denominacao",
    "Finalidade",
    "Referencia",
    "Coordenacao",
    "Orgaos_Componentes",
    "Representantes",
    "Setor_Representante",
    "Remuneracao",
    "Em_Atividade",
    "Ato_Criacao",
    "Data_Criacao",
    "Interna_Externa",
    "Prazo",
    "Setor_Titular",
    "Valor",
    "Relacionamento_CONSUG_CG",
    "Ato_Principal",
    "Ato_Decreto",
    "Tema",
    "Membros_ACMD",
    "Membros_ACMD_FA",
    "Finalidade_Nova_Incremental",
    "Representacao_Colegiado",
    "Identificador_Link",
  ];

  const linhas = [COLUNAS.join(";")];

////////////////////////////////////////////////
// 7
  dados.forEach((item, index) => {
    const row = {
      Controle: "",
      ID: index + 1,
      Data: "",
      Hora: "",
      Usuario: "",

      Documento: safe(item.Documento),
      TipoColegiado: safe(item.TipoColegiado || "outro"),
      Setor: "",
      Atividade: safe(item.Atividade || "outro"),
      Denominacao: safe(item.Nome || "inexistente"),

      Finalidade: safe(item.Finalidade || "inexistente"),
      Referencia: "",
      Coordenacao: "",
      Orgaos_Componentes: safe(item.Orgaos_Componentes || "inexistente"),
      Representantes: safe(item.Representantes || "inexistente"),
      Setor_Representante: "",
      Remuneracao: "",
      Em_Atividade: "",
      Ato_Criacao: "",
      Data_Criacao: "",
      Interna_Externa: "",
      Prazo: "",
      Setor_Titular: "",
      Valor: "",
      Relacionamento_CONSUG_CG: "",
      Ato_Principal: "",
      Ato_Decreto: "",
      Tema: "",
      Membros_ACMD: "",
      Membros_ACMD_FA: "",
      Finalidade_Nova_Incremental: "",
      Representacao_Colegiado: "",
      Identificador_Link: safe(item.PDF),
    };

    const linha = COLUNAS.map(col => safe(row[col])).join(";");
    linhas.push(linha);
  });

  const conteudo = linhas.join("\n");
  const filePath = path.join(process.cwd(), "relatorio.csv");

  fs.writeFileSync(filePath, conteudo, "utf-8");

  console.log("CSV gerado em:", filePath);
}

/**
 * Principal
 */
async function analisarLinks(urlBusca) {
  const links = await coletarLinksPaginados(urlBusca);

  const resultado = [];
  const concorrencia = 10;

  for (let i = 0; i < links.length; i += concorrencia) {
    const lote = links.slice(i, i + concorrencia);

    const processados = await Promise.all(
      lote.map((item) => processarLink(item))
    );

    const filtrados = processados.filter(
      (item) => item._passaFiltro === true
    );

    resultado.push(...filtrados);
  }

  gerarCsvNaRaiz(resultado);

  return resultado;
}

module.exports = {
  analisarLinks,
};