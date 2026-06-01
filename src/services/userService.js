const supabase = require("../config/supabase");

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function cadastrarUsuario({ nome, email }) {
  const nomeLimpo = removerAcentos(nome);
  const emailLimpo = normalizarEmail(email);

  if (!nomeLimpo || !emailLimpo) {
    throw new Error("Nome e e-mail são obrigatórios.");
  }

  const { data, error } = await supabase
    .from("usuarios")
    .insert([
      {
        nome: nomeLimpo,
        email: emailLimpo,
        criado_em: new Date().toISOString(),
      },
    ])
    .select("id")
    .single();

  if (error) {
    if (
      String(error.message || "").includes("usuarios_email_defesa_check") ||
      String(error.details || "").includes("usuarios_email_defesa_check")
    ) {
      throw new Error(
        "Cadastro autorizado somente para e-mails institucionais do Ministério da Defesa."
      );
    }

    if (error.code === "23505") {
      throw new Error("Este e-mail já está cadastrado.");
    }

    throw error;
  }

  return data;
}

module.exports = {
  cadastrarUsuario,
  removerAcentos,
  normalizarEmail,
};