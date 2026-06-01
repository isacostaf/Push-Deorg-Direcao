const path = require("path");
const os = require("os");

function isVercel() {
  return process.env.VERCEL === "1";
}

function getBaseStorageDir() {
  return path.join(os.tmpdir(), "representacoes-aa");
}

module.exports = {
  isVercel,
  getBaseStorageDir,
};
