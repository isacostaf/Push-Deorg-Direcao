const fs = require("fs");
const path = require("path");
const { getBaseStorageDir } = require("../config");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createRunDirs(runId) {
  const base = getBaseStorageDir();
  const runDir = path.join(base, runId);
  const pdfBase = path.join(runDir, "pdfs");
  const altaDir = path.join(pdfBase, "alta_probabilidade");
  const baixaDir = path.join(pdfBase, "baixa_probabilidade");

  ensureDir(altaDir);
  ensureDir(baixaDir);

  return {
    runDir,
    pdfBase,
    altaDir,
    baixaDir,
    csvPath: path.join(runDir, "relatorio.csv"),
  };
}

function safeFileName(value) {
  return String(value || "documento")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, "_") || "documento";
}

module.exports = {
  ensureDir,
  createRunDirs,
  safeFileName,
};
