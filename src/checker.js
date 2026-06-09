const xlsx = require('xlsx');
const path = require('path');

/**
 * Retorna a data atual no formato DD-MM-AAAA
 * ajustada para o fuso horário de Brasília.
 */
// function getTodayBR() {
//   const now = new Date();

//   const brOffset = -3 * 60;
//   const utc = now.getTime() + now.getTimezoneOffset() * 60000;
//   const brDate = new Date(utc + brOffset * 60000);

//   const day = String(brDate.getDate()).padStart(2, '0');
//   const month = String(brDate.getMonth() + 1).padStart(2, '0');
//   const year = brDate.getFullYear();

//   return `${day}-${month}-${year}`;
// }

// ----------------------------------
// APENAS TESTE
// FUNCAO PARA RODAR DATA ESPECIFICA
// DESCOMENTAR OU COMENTAR
function getTodayBR() {
  return '01-06-2026';
}

/**
 * Monta a URL de pesquisa do DOU
 * para um processo e uma data específica.
 */
function buildUrl(processCode, dateStr) {
  const encoded = encodeURIComponent(`" ${processCode}"`);

  return `https://www.in.gov.br/consulta/-/buscar/dou?q=${encoded}&s=todos&exactDate=personalizado&sortType=0&publishFrom=${dateStr}&publishTo=${dateStr}`;
}

/**
 * Extrai códigos de processo da coluna B (ignora cabeçalho).
 */
function readProcessCodesFromRows(rows) {
  const codes = [];

  for (const row of rows.slice(1)) {
    if (
      row &&
      row[1] !== undefined &&
      row[1] !== null &&
      row[1] !== ''
    ) {
      codes.push(String(row[1]).trim());
    }
  }

  return codes;
}

/**
 * Lê os códigos de processo da planilha
 * processos.xlsx (coluna B).
 */
function readProcessCodes() {
  const xlsxPath = path.join(process.cwd(), 'processos.xlsx');
  const wb = xlsx.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  return readProcessCodesFromRows(rows);
}

function readProcessCodesFromBuffer(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  return { wb, codes: readProcessCodesFromRows(rows) };
}

/**
 * Consulta um processo no DOU e verifica
 * se houve resultado para a data informada.
 */
async function checkProcess(processCode, dateStr) {
  const url = buildUrl(processCode, dateStr);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DOU-Monitor/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return {
        processCode,
        url,
        found: false,
        error: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();

    const noResult =
      html.includes('Nenhum resultado encontrado') ||
      html.includes('nenhum resultado') ||
      html.includes('0 resultado');

    const hasResult =
      !noResult &&
      (
        html.includes('resultado') ||
        html.includes('class="resultado"') ||
        html.includes('resultados-busca')
      );

    return {
      processCode,
      url,
      found: hasResult,
    };
  } catch (err) {
    return {
      processCode,
      url,
      found: false,
      error: err.message,
    };
  }
}

/**
 * Aplica os resultados da verificação na coluna C da planilha.
 */
function applyResultsToWorkbook(wb, results) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  rows[0][2] = 'check';

  results.forEach((result, index) => {
    const rowIndex = index + 1;

    if (!rows[rowIndex]) {
      rows[rowIndex] = [];
    }

    rows[rowIndex][2] = result.found ? 'sim' : 'nao';
  });

  wb.Sheets[wb.SheetNames[0]] = xlsx.utils.aoa_to_sheet(rows);
  return wb;
}

function markDuplicatesInWorkbook(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const header = rows[0];
  const data = rows.slice(1);
  const countMap = new Map();

  for (const row of data) {
    const process = row[1];
    const status = String(row[2] || '').toLowerCase();

    if (status === 'sim') {
      countMap.set(process, (countMap.get(process) || 0) + 1);
    }
  }

  for (const row of data) {
    const process = row[1];
    const status = String(row[2] || '').toLowerCase();

    if (status === 'sim' && countMap.get(process) > 1) {
      row[2] = 'verificar';
    }
  }

  wb.Sheets[wb.SheetNames[0]] = xlsx.utils.aoa_to_sheet([header, ...data]);
  return wb;
}

/**
 * Salva uma nova planilha contendo
 * o resultado da verificação na coluna C.
 */
function saveResultsSpreadsheet(results) {
  const inputPath = path.join(process.cwd(), 'processos.xlsx');
  const outputPath = path.join(process.cwd(), 'processos_resultado.xlsx');

  const wb = xlsx.readFile(inputPath);
  applyResultsToWorkbook(wb, results);
  markDuplicatesInWorkbook(wb);
  xlsx.writeFile(wb, outputPath);

  console.log(`📄 Resultado salvo em ${outputPath}`);
}

async function checkAllProcesses(codes, dateStr) {
  const results = [];

  for (const code of codes) {
    console.log(`🔍 Verificando: ${code}`);

    const result = await checkProcess(code, dateStr);
    results.push(result);

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return results;
}

/**
 * Consulta um lote de processos em paralelo (sem delay).
 * Usado pela API web — cada lote deve caber no timeout de 10s do Vercel Hobby.
 */
async function checkBatch(codes, dateStr) {
  return Promise.all(codes.map(code => checkProcess(code, dateStr)));
}

/**
 * Processa um arquivo Excel enviado pelo usuário
 * e retorna o buffer da planilha de resultados.
 */
async function runChecksFromBuffer(buffer) {
  const dateStr = getTodayBR();
  const { wb, codes } = readProcessCodesFromBuffer(buffer);

  if (codes.length === 0) {
    throw new Error('Nenhum código de processo encontrado na planilha.');
  }

  console.log(`📅 Data de hoje (BR): ${dateStr}`);
  console.log(`📋 ${codes.length} processo(s) encontrado(s)\n`);

  const results = await checkAllProcesses(codes, dateStr);

  applyResultsToWorkbook(wb, results);
  markDuplicatesInWorkbook(wb);

  const outputBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return { date: dateStr, results, outputBuffer };
}

/**
 * Função principal:
 * lê a planilha, consulta todos os processos
 * e gera a planilha final com os resultados.
 */
async function runChecks() {
  const dateStr = getTodayBR();
  const codes = readProcessCodes();

  if (codes.length === 0) {
    throw new Error('Nenhum código de processo encontrado na planilha.');
  }

  console.log(`📅 Data de hoje (BR): ${dateStr}`);
  console.log(`📋 ${codes.length} processo(s) encontrado(s)\n`);

  const results = await checkAllProcesses(codes, dateStr);

  saveResultsSpreadsheet(results);

  return { date: dateStr, results };
}

module.exports = {
  runChecks,
  runChecksFromBuffer,
  checkBatch,
  getTodayBR,
};