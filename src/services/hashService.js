const supabase = require("../config/supabase");

async function buscarHashDoDia(data) {
  const { data: row, error } = await supabase
    .from("controle_execucao")
    .select("hash")
    .eq("data", data)
    .maybeSingle();

  if (error) throw error;

  return row?.hash || null;
}

async function salvarHashDoDia(data, hash) {
  const { error } = await supabase
    .from("controle_execucao")
    .upsert(
      {
        data,
        hash,
        atualizado_em: new Date().toISOString(),
      },
      {
        onConflict: "data",
      }
    );

  if (error) throw error;
}

module.exports = {
  buscarHashDoDia,
  salvarHashDoDia,
};