////////////////////////////////////////////////
// 1
const { identificarAtividade } = require("./atividadeExtractor");
const { extrairNome } = require("./nomeExtractor");
const { extrairTipoColegiado } = require("./tipoColegiadoExtractor");
const { extrairRepresentantesDefesa } = require("./representantesExtractor");
const { extrairOrgaosComponentes } = require("./orgaosComponentesExtractor");
const { extrairFinalidade } = require("./finalidadeExtractor");

////////////////////////////////////////////////
// 2
module.exports = {
  identificarAtividade,
  extrairNome,
  extrairTipoColegiado,
  extrairRepresentantesDefesa,
  extrairOrgaosComponentes,
  extrairFinalidade,
};