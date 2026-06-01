const crypto = require("crypto");

const { createRunDirs } = require("../utils/storage");
const { formatDateYmd, formatDateDmyFromYmd } = require("./dateService");
const { obterLinkBusca } = require("./searchService");
const { analisarLinks } = require("./analysisService");
const {
  gerarRelatorio,
  gerarCsvDownload,
  salvarCsv,
} = require("./reportService");
const { baixarPdfs } = require("./pdfService");
function gerar_hash(dados) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(dados))
    .digest("hex");
}

function normalizeDateYmd(dateYmd) {
  const [year, month, day] = String(dateYmd || "").split("-");

  return {
    year,
    month: month.padStart(2, "0"),
    day: day.padStart(2, "0"),
  };
}

async function executarCron({ dataYmd } = {}) {
  const dataProcesso = dataYmd || formatDateYmd(new Date());
  const { year, month, day } = normalizeDateYmd(dataProcesso);
  const dataInicialStr = formatDateDmyFromYmd(`${year}-${month}-${day}`);
  const dataFinalStr = formatDateDmyFromYmd(`${year}-${month}-${day}`);
  const dataBanco = `${year}-${month}-${day}`;

  const runId = crypto.randomUUID();
  const dirs = createRunDirs(runId);

  const urlBusca = await obterLinkBusca(dataInicialStr, dataFinalStr);
  const resumo = await analisarLinks(urlBusca);
  const relatorio = gerarRelatorio(resumo);
  const csvDownload = gerarCsvDownload(resumo);

  salvarCsv(dirs.csvPath, csvDownload);
  await baixarPdfs(relatorio, dirs);

  const hash = gerar_hash(relatorio);

  return {
    dataBanco,
    resumo,
    relatorio,
    dirs,
    hash,
  };
}

module.exports = {
  executarCron,
};