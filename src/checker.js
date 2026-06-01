const xlsx = require('xlsx');
const path = require('path');

function getTodayBR() {
  const now = new Date();
  // Adjust to Brazil time (UTC-3)
  const brOffset = -3 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const brDate = new Date(utc + brOffset * 60000);

  const day = String(brDate.getDate()).padStart(2, '0');
  const month = String(brDate.getMonth() + 1).padStart(2, '0');
  const year = brDate.getFullYear();
  return `${day}-${month}-${year}`;
}

function buildUrl(processCode, dateStr) {
  const encoded = encodeURIComponent(`" ${processCode}"`);
  return `https://www.in.gov.br/consulta/-/buscar/dou?q=${encoded}&s=todos&exactDate=personalizado&sortType=0&publishFrom=${dateStr}&publishTo=${dateStr}`;
}

function readProcessCodes() {
  const xlsxPath = path.join(process.cwd(), 'processos.xlsx');
  const wb = xlsx.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const codes = [];
  for (const row of rows) {
    if (row && row[1] !== undefined && row[1] !== null && row[1] !== '') {
      codes.push(String(row[1]).trim());
    }
  }
  return codes;
}

async function checkProcess(processCode, dateStr) {
  const url = buildUrl(processCode, dateStr);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DOU-Monitor/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return { processCode, url, found: false, error: `HTTP ${res.status}` };
    }

    const html = await res.text();

    // DOU returns results inside these markers — if no results, page shows "nenhum resultado"
    const noResult =
      html.includes('Nenhum resultado encontrado') ||
      html.includes('nenhum resultado') ||
      html.includes('0 resultado');

    const hasResult = !noResult && (
      html.includes('resultado') ||
      html.includes('class="resultado"') ||
      html.includes('resultados-busca')
    );

    return { processCode, url, found: hasResult };
  } catch (err) {
    return { processCode, url, found: false, error: err.message };
  }
}

async function runChecks() {
  const dateStr = getTodayBR();
  const codes = readProcessCodes();

  if (codes.length === 0) {
    throw new Error('Nenhum código de processo encontrado na planilha (coluna B).');
  }

  console.log(`📅 Data de hoje (BR): ${dateStr}`);
  console.log(`📋 ${codes.length} processo(s) encontrado(s) na planilha\n`);

  const results = [];
  for (const code of codes) {
    console.log(`🔍 Verificando: ${code}`);
    const result = await checkProcess(code, dateStr);
    results.push(result);
    // Small delay to avoid overwhelming the server
    await new Promise(r => setTimeout(r, 1500));
  }

  return { date: dateStr, results };
}

module.exports = { runChecks, getTodayBR };
