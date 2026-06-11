function limparTexto(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairTag(html, classe) {
  const match = html.match(new RegExp(`<p[^>]*class="${classe}"[^>]*>([\\s\\S]*?)<\\/p>`, 'i'));
  return match ? match[1] : '';
}

async function fetchAto(atoUrl) {
  const res = await fetch(atoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DOU-Monitor/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();

  // O bloco texto-dou contém um documento HTML completo embutido
  const blocoMatch = html.match(/<div[^>]*class="texto-dou"[^>]*>([\s\S]*?)<\/html>/i);
  if (!blocoMatch) return null;

  const inner = blocoMatch[1];

  const identifica = limparTexto(extrairTag(inner, 'identifica'));
  const ementa     = limparTexto(extrairTag(inner, 'ementa'));
  const assina     = limparTexto(extrairTag(inner, 'assina'));

  const paragrafos = [];
  const paraRegex = /<p[^>]*class="dou-paragraph"[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = paraRegex.exec(inner)) !== null) {
    const texto = limparTexto(m[1]);
    if (texto) paragrafos.push(texto);
  }

  return { atoUrl, identifica, ementa, assina, paragrafos };
}

module.exports = { fetchAto };
