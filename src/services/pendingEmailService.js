const supabase = require("../config/supabase");

async function listarPendencias() {
  const { data, error } = await supabase
    .from("pendencias_envio")
    .select("data, csv_path, pdf_paths, linhas")
    .eq("status", "pendente")
    .order("data", { ascending: true });

  if (error) throw error;

  return (data || []).map((item) => ({
    data: String(item.data || "").trim(),
    csvPath: item.csv_path || null,
    pdfPaths: Array.isArray(item.pdf_paths) ? item.pdf_paths : [],
    linhas: Array.isArray(item.linhas) ? item.linhas : [],
  }));
}

async function salvarPendencia({ data, csvPath, pdfPaths, linhas }) {
  const dataLimpa = String(data || "").trim();
  if (!dataLimpa) {
    throw new Error("Data obrigatoria para salvar pendencia.");
  }

  const { error } = await supabase
    .from("pendencias_envio")
    .upsert(
      {
        data: dataLimpa,
        csv_path: csvPath || null,
        pdf_paths: Array.isArray(pdfPaths) ? pdfPaths : [],
        linhas: Array.isArray(linhas) ? linhas : [],
        status: "pendente",
        criado_em: new Date().toISOString(),
      },
      {
        onConflict: "data",
      }
    );

  if (error) throw error;
}

async function marcarEnviado(datas) {
  const lista = (datas || [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!lista.length) {
    return;
  }

  const { error } = await supabase
    .from("pendencias_envio")
    .update({
      status: "enviado",
      enviado_em: new Date().toISOString(),
    })
    .in("data", lista);

  if (error) throw error;
}

module.exports = {
  listarPendencias,
  salvarPendencia,
  marcarEnviado,
};
