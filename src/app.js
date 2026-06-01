//app.js

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto"); 
const express = require("express");

const { createRunDirs } = require("./utils/storage");
const { obterLinkBusca } = require("./services/searchService");
const { analisarLinks } = require("./services/analysisService");
const { gerarRelatorio, gerarCsvDownload, salvarCsv } = require("./services/reportService");
const { baixarPdfs, criarZipBuffer } = require("./services/pdfService");
// const { enviarEmail } = require("./services/emailService");
// const { cadastrarUsuario } = require("./services/userService");
const { saveRun, getRun } = require("./state");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);

  res.render("index", {
    data: hoje,
    erro: "",
    aviso: "",
    runId: "",
    rows: [],
  });
});

// app.post("/subscribe", async (req, res) => {
//   const hoje = new Date().toISOString().slice(0, 10);
//   const nome = String(req.body.name || "");
//   const email = String(req.body.email || "");

//   try {
//     await cadastrarUsuario({ nome, email });
//     return res.render("index", {
//       dataInicial: hoje,
//       dataFinal: hoje,
//       erro: "",
//       aviso: "Cadastro realizado com sucesso.",
//       runId: "",
//       rows: [],
//     });
//   } catch (error) {
//     return res.status(400).render("index", {
//       dataInicial: hoje,
//       dataFinal: hoje,
//       erro: `Falha no cadastro: ${error.message}`,
//       aviso: "",
//       runId: "",
//       rows: [],
//     });
//   }
// });

app.post("/process", async (req, res) => {
  const data = String(req.body.data || "");

  if (!data) {
    return res.status(400).render("index", {
      data,
      erro: "Data é obrigatória.",
      aviso: "",
      runId: "",
      rows: [],
    });
  }

  const [ano, mes, dia] = data.split("-");
  const dataStr = `${dia}/${mes}/${ano}`;

  try {
    const runId = crypto.randomUUID();
    const dirs = createRunDirs(runId);

    const urlBusca = await obterLinkBusca(dataStr);
    const resumo = await analisarLinks(urlBusca);

    const relatorio = gerarRelatorio(resumo);
    const csvDownload = gerarCsvDownload(resumo);

    salvarCsv(dirs.csvPath, csvDownload);

    await baixarPdfs(relatorio, dirs);

    saveRun(runId, {
      data,
      rows: relatorio,
      dirs,
    });

    const totalDocumentos = resumo.length;
    const totalClassificados = relatorio.length;
    let aviso = "";

    if (totalDocumentos === 0) {
      aviso = "Nenhum documento foi retornado pela busca para o periodo informado.";
    } else if (totalClassificados === 0) {
      aviso = `Foram encontrados ${totalDocumentos} documento(s), mas nenhum atingiu o criterio minimo de classificacao.`;
    }

    return res.render("index", {
      data,
      erro: "",
      aviso,
      runId,
      rows: relatorio,
    });
  } catch (error) {
    return res.status(500).render("index", {
      data,
      erro: `Falha no processamento: ${error.message}`,
      aviso: "",
      runId: "",
      rows: [],
    });
  }
});

app.get("/download/csv/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run || !fs.existsSync(run.dirs.csvPath)) {
    return res.status(404).send("Arquivo nao encontrado.");
  }

  return res.download(run.dirs.csvPath, "relatorio.csv");
});

app.get("/download/zip/:runId/:tipo", async (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return res.status(404).send("Processamento nao encontrado.");
  }

  const tipo = req.params.tipo;
  const dir = tipo === "alta"
    ? run.dirs.altaDir
    : tipo === "baixa"
      ? run.dirs.baixaDir
      : "";

  if (!dir || !fs.existsSync(dir)) {
    return res.status(404).send("Pasta nao encontrada.");
  }

  try {
    const zip = await criarZipBuffer(dir);
    const fileName = tipo === "alta" ? "alta_probabilidade.zip" : "baixa_probabilidade.zip";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    return res.send(zip);
  } catch (error) {
    return res.status(500).send(`Falha ao gerar ZIP: ${error.message}`);
  }
});

// app.post("/email/:runId", async (req, res) => {
//   const run = getRun(req.params.runId);
//   if (!run) {
//     return res.status(404).send("Processamento nao encontrado.");
//   }

//   try {
//     await enviarEmail({
//       csvPath: run.dirs.csvPath,
//       pdfBase: run.dirs.pdfBase,
//       linhas: run.rows,
//     });

//     return res.redirect("/");
//   } catch (error) {
//     return res.status(500).send(`Falha ao enviar e-mail: ${error.message}`);
//   }
// });

module.exports = app;
