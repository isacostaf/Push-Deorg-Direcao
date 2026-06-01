require("dotenv").config();

const { executarCron } = require("./cronService");
const { enviarEmail, enviarEmailAcumulado } = require("./emailService");
const { buscarHashDoDia, salvarHashDoDia } = require("./hashService");
const { obterFeriadosBrasil, isDiaUtil } = require("./bussinesDayEmai");
const { formatDateYmd, formatDateDmyFromYmd } = require("./dateService");
const { listarPendencias, salvarPendencia, marcarEnviado } = require("./pendingEmailService");
const { uploadRunFiles, downloadEmailAssets } = require("./storageService");

function getPeriodoLabel(datas) {
  const ordenadas = (datas || []).filter(Boolean).sort();
  if (!ordenadas.length) {
    return "";
  }

  const inicio = ordenadas[0];
  const fim = ordenadas[ordenadas.length - 1];

  if (inicio === fim) {
    return formatDateDmyFromYmd(inicio);
  }

  return `${formatDateDmyFromYmd(inicio)} a ${formatDateDmyFromYmd(fim)}`;
}

module.exports = async function handler(req, res) {
  try {
    const dataOverride = String(req.query?.data || "").trim();
    const hoje = dataOverride ? new Date(`${dataOverride}T12:00:00`) : new Date();
    const dataHoje = dataOverride || formatDateYmd(hoje);
    const ano = Number(dataHoje.split("-")[0]);
    const feriados = await obterFeriadosBrasil(ano);

    if (!isDiaUtil(hoje, feriados)) {
      const { dataBanco, resumo, relatorio, dirs, hash } = await executarCron({
        dataYmd: dataHoje,
      });

      const hashAnterior = await buscarHashDoDia(dataBanco);

      if (hashAnterior === hash) {
        return res.status(200).json({
          success: true,
          message: "Dia nao util. Nenhuma mudanca detectada.",
          data: dataHoje,
          totalDocumentos: resumo.length,
          totalClassificados: relatorio.length,
        });
      }

      const storage = await uploadRunFiles({
        dateYmd: dataBanco,
        csvPath: dirs.csvPath,
        pdfBase: dirs.pdfBase,
      });

      await salvarPendencia({
        data: dataBanco,
        csvPath: storage.csvPath,
        pdfPaths: storage.pdfPaths,
        linhas: relatorio,
      });

      await salvarHashDoDia(dataBanco, hash);

      return res.status(200).json({
        success: true,
        message: "Dia nao util. Email acumulado para envio no proximo dia util.",
        data: dataHoje,
        totalDocumentos: resumo.length,
        totalClassificados: relatorio.length,
      });
    }

    const pendencias = await listarPendencias();
    const datasPendentes = pendencias.map((item) => item.data).filter(Boolean);
    const datasParaProcessar = datasPendentes.includes(dataHoje)
      ? [...datasPendentes]
      : [...datasPendentes, dataHoje];

    const resultados = [];
    const enviados = [];
    const itensParaEmail = [];

    for (const dataYmd of datasParaProcessar) {
      const pendencia = pendencias.find((item) => item.data === dataYmd);

      if (pendencia) {
        const { csvPath, pdfBase } = await downloadEmailAssets({
          dateYmd: dataYmd,
          csvPath: pendencia.csvPath,
          pdfPaths: pendencia.pdfPaths,
        });

        itensParaEmail.push({
          data: dataYmd,
          csvPath,
          pdfBase,
          linhas: pendencia.linhas || [],
        });

        resultados.push({
          data: dataYmd,
          enviado: true,
          origem: "pendencia",
        });
        enviados.push(dataYmd);
        continue;
      }

      const { dataBanco, resumo, relatorio, dirs, hash } = await executarCron({ dataYmd });

      const hashAnterior = await buscarHashDoDia(dataBanco);

      if (hashAnterior === hash) {
        resultados.push({
          data: dataBanco,
          enviado: false,
          motivo: "Nenhuma mudanca detectada.",
        });
        continue;
      }

      const storage = await uploadRunFiles({
        dateYmd: dataBanco,
        csvPath: dirs.csvPath,
        pdfBase: dirs.pdfBase,
      });

      await salvarPendencia({
        data: dataBanco,
        csvPath: storage.csvPath,
        pdfPaths: storage.pdfPaths,
        linhas: relatorio,
      });

      itensParaEmail.push({
        data: dataBanco,
        csvPath: dirs.csvPath,
        pdfBase: dirs.pdfBase,
        linhas: relatorio,
      });

      await salvarHashDoDia(dataBanco, hash);

      resultados.push({
        data: dataBanco,
        enviado: true,
        totalDocumentos: resumo.length,
        totalClassificados: relatorio.length,
      });
      enviados.push(dataBanco);
    }

    if (itensParaEmail.length > 1 || datasPendentes.length > 0) {
      const periodoLabel = getPeriodoLabel(itensParaEmail.map((item) => item.data));

      if (itensParaEmail.length) {
        await enviarEmailAcumulado({
          itens: itensParaEmail,
          periodoLabel,
        });
      }
    } else if (itensParaEmail.length === 1) {
      const unico = itensParaEmail[0];
      const periodoLabel = unico.data ? formatDateDmyFromYmd(unico.data) : "";
      await enviarEmail({
        csvPath: unico.csvPath,
        pdfBase: unico.pdfBase,
        linhas: unico.linhas,
        periodoLabel,
      });
    }

    await marcarEnviado(enviados);

    return res.status(200).json({
      success: true,
      message: "Processamento concluido.",
      resultados,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erro ao executar cron.",
      error: error.message,
    });
  }
};
