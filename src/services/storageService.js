const fs = require("fs");
const os = require("os");
const path = require("path");
const supabase = require("../config/supabase");
const { ensureDir } = require("../utils/storage");

function getBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET || "radar-arquivos";
}

function normalizeStoragePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeStorageSegment(value) {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || "arquivo";
}

function normalizeStorageKey(value) {
  const normalized = normalizeStoragePath(value);
  return normalized
    .split("/")
    .map((segment) => normalizeStorageSegment(segment))
    .join("/");
}

function listarPdfs(pdfBase) {
  if (!fs.existsSync(pdfBase)) {
    return [];
  }

  const stack = [pdfBase];
  const files = [];

  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function uploadFile({ localPath, storagePath, contentType }) {
  const bucket = getBucketName();
  const buffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) {
    throw error;
  }

  return storagePath;
}

async function uploadRunFiles({ dateYmd, csvPath, pdfBase }) {
  const base = normalizeStoragePath(`emails/${dateYmd}`);
  const csvStoragePath = `${base}/relatorio.csv`;
  await uploadFile({
    localPath: csvPath,
    storagePath: csvStoragePath,
    contentType: "text/csv",
  });

  const pdfPaths = [];
  for (const pdfPath of listarPdfs(pdfBase)) {
    const relPath = normalizeStoragePath(path.relative(pdfBase, pdfPath));
    const safeRelPath = normalizeStorageKey(relPath);
    const storagePath = `${base}/pdfs/${safeRelPath}`;
    await uploadFile({
      localPath: pdfPath,
      storagePath,
      contentType: "application/pdf",
    });
    pdfPaths.push(storagePath);
  }

  return {
    csvPath: csvStoragePath,
    pdfPaths,
  };
}

async function downloadFile({ storagePath, localPath }) {
  const bucket = getBucketName();
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);

  if (error) {
    throw error;
  }

  let buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (data && typeof data.arrayBuffer === "function") {
    const arrayBuffer = await data.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else if (data instanceof Uint8Array) {
    buffer = Buffer.from(data);
  } else if (data && typeof data.pipe === "function") {
    const chunks = [];
    for await (const chunk of data) {
      chunks.push(chunk);
    }
    buffer = Buffer.concat(chunks);
  } else {
    throw new Error("Formato de arquivo nao suportado para download.");
  }

  ensureDir(path.dirname(localPath));
  fs.writeFileSync(localPath, buffer);
  return localPath;
}

async function downloadEmailAssets({ dateYmd, csvPath, pdfPaths }) {
  const baseDir = path.join(os.tmpdir(), "representacoes-aa", "downloads", dateYmd);
  ensureDir(baseDir);

  const localCsvPath = path.join(baseDir, "relatorio.csv");
  await downloadFile({ storagePath: csvPath, localPath: localCsvPath });

  const pdfBase = path.join(baseDir, "pdfs");
  ensureDir(pdfBase);

  for (const storagePath of pdfPaths || []) {
    const marker = "/pdfs/";
    const relPart = storagePath.includes(marker)
      ? storagePath.split(marker)[1]
      : path.basename(storagePath);
    const localPath = path.join(pdfBase, relPart.split("/").join(path.sep));
    await downloadFile({ storagePath, localPath });
  }

  return {
    csvPath: localCsvPath,
    pdfBase,
  };
}

module.exports = {
  getBucketName,
  uploadRunFiles,
  downloadEmailAssets,
};
