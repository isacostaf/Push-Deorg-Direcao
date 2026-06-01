const axios = require("axios");
const cheerio = require("cheerio");
const vm = require("vm");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPublishParam(datePtBr) {
  const [dd, mm, yyyy] = String(datePtBr || "").split("/");
  if (!dd || !mm || !yyyy) return "";
  return `${dd}-${mm}-${yyyy}`;
}

async function obterLinkBusca(dataStr) {
  const data = toPublishParam(dataStr);
  return `https://www.in.gov.br/consulta/-/buscar/dou?q=*&s=do1&s=do2&s=doe&s=do1a&exactDate=personalizado&sortType=0&publishFrom=${data}&publishTo=${data}`;
}

function buildUrlWithParams(action, inputs) {
  const url = new URL(action);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(inputs)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        params.append(key, String(v));
      }
    } else if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  url.search = params.toString();
  return url.toString();
}

function extractParamsJson(html) {
  const marker = 'id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params"';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const openTagEnd = html.indexOf(">", idx);
  if (openTagEnd === -1) return null;

  const closeTagStart = html.indexOf("</script>", openTagEnd);
  if (closeTagStart === -1) return null;

  const raw = html.slice(openTagEnd + 1, closeTagStart).trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function extractRequestObject(html, context) {
  const startIdx = html.indexOf("var request");
  if (startIdx === -1) return null;

  const paginationIdx = html.indexOf("var paginationData", startIdx);
  if (paginationIdx === -1) return null;

  const startBraceIdx = html.indexOf("{", startIdx);
  if (startBraceIdx === -1 || startBraceIdx > paginationIdx) return null;

  const endBraceIdx = html.lastIndexOf("}", paginationIdx);
  if (endBraceIdx === -1 || endBraceIdx <= startBraceIdx) return null;

  const objectLiteral = html.slice(startBraceIdx, endBraceIdx + 1);
  try {
    return vm.runInNewContext(`(${objectLiteral})`, context || {});
  } catch (error) {
    return null;
  }
}

async function coletarLinksPaginados(urlBusca, maxPaginas = 200) {
  const linksUnicos = [];
  const vistos = new Set();

  let currentUrl = urlBusca;

  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const response = await axios.get(currentUrl, {
      timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const html = String(response.data || "");
    const $ = cheerio.load(html);

    $("a[href*='/web/dou/']").each((_, el) => {
      const href = String($(el).attr("href") || "").trim();
      const titulo = String($(el).text() || "").trim() || "Sem titulo";
      if (!href || vistos.has(href)) return;
      vistos.add(href);
      linksUnicos.push({ titulo, href });
    });

    const paramsJson = extractParamsJson(html);
    const hits = paramsJson && Array.isArray(paramsJson.jsonArray) ? paramsJson.jsonArray : [];
    const request = extractRequestObject(html, { hits });

    if (hits.length) {
      for (const item of hits) {
        const urlTitle = item.urlTitle || item.urlTitle_pt_BR || item.urlTitlePTBR || item.urlTitlePtBr;
        const href = urlTitle ? `https://www.in.gov.br/web/dou/-/${urlTitle}` : "";
        const titulo = item.title_pt_BR || item.title || item.titulo || item.titulo_pt_BR || "Sem titulo";
        if (!href || vistos.has(href)) continue;
        vistos.add(href);
        linksUnicos.push({ titulo: String(titulo).trim() || "Sem titulo", href });
      }
    }

    if (!request || !request.totalPages || request.currentPage >= request.totalPages) {
      break;
    }

    const requestHits = Array.isArray(request.hits) ? request.hits : hits;
    if (!requestHits.length) break;

    const last = requestHits[requestHits.length - 1];

    const baseInputs = Object.fromEntries(new URL(currentUrl).searchParams.entries());
    const sections = request.sectionsString ? String(request.sectionsString).split(",") : (baseInputs.s ? [baseInputs.s] : ["todos"]);
    const q = baseInputs.q || "\"Ministerio da Defesa\"";

    const inputs = {
      q,
      s: sections,
      exactDate: request.exactDate,
      sortType: request.sortType,
      delta: request.delta,
      currentPage: request.currentPage,
      newPage: request.currentPage + 1,
      score: last.score,
      id: last.classPK,
      displayDate: last.displayDateSortable,
    };

    if (request.exactDate === "personalizado") {
      inputs.publishFrom = request.publishFrom;
      inputs.publishTo = request.publishTo;
    }

    if (request.reverseSort) {
      inputs.reverseSort = request.reverseSort;
    }

    currentUrl = buildUrlWithParams(request.buscadouURL || "https://www.in.gov.br/consulta/-/buscar/dou", inputs);

    await sleep(250);
  }

  return linksUnicos;
}

module.exports = {
  obterLinkBusca,
  coletarLinksPaginados,
};
