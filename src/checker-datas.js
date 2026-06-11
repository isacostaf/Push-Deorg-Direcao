// checker-datas
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const path = require('path');

function buildUrl(processCode, dateFrom, dateTo) {
  const encoded = encodeURIComponent(`" ${processCode}"`);

  return `https://www.in.gov.br/consulta/-/buscar/dou?q=${encoded}&s=todos&exactDate=personalizado&sortType=0&publishFrom=${dateFrom}&publishTo=${dateTo}`;
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
  const csvPath = path.join(process.cwd(), 'processos.csv');

  const content = fs.readFileSync(csvPath, 'utf8');

  const rows = parse(content, {
    delimiter: ';',
    skip_empty_lines: true
  });

  return readProcessCodesFromRows(rows);
}

function readProcessCodesFromBuffer(buffer) {
  const content = buffer.toString('utf8');

  const rows = parse(content, {
    delimiter: ';',
    skip_empty_lines: true
  });

  return {
    rows,
    codes: readProcessCodesFromRows(rows)
  };
}

/**
 * Consulta um processo no DOU e verifica
 * se houve resultado para a data informada.
 */
async function checkProcess(processCode, dateFrom, dateTo) {
  // console.log('checkProcess recebeu:');
  // console.log('dateFrom =', dateFrom);
  // console.log('dateTo   =', dateTo);

  const url = buildUrl(processCode, dateFrom, dateTo);

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

    console.log('🔗 URL:', url); // 👈 AQUI
    console.log('📋 Processo:', processCode);
    console.log('❌ noResult:', noResult);
    console.log('✅ hasResult:', hasResult);
    console.log('--------------------');

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
function applyResultsToRows(rows, results) {
  rows[0][2] = 'check';

  results.forEach((result, index) => {
    const rowIndex = index + 1;

    if (!rows[rowIndex]) {
      rows[rowIndex] = [];
    }

    rows[rowIndex][2] = result.found ? 'sim' : 'nao';
  });

  return rows;
}

function markDuplicatesInRows(rows) {
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

  return [header, ...data];
}

/**
 * Salva uma nova planilha contendo
 * o resultado da verificação na coluna C.
 */
function saveResultsCsv(results) {
  const inputPath = path.join(process.cwd(), 'processos.csv');
  const outputPath = path.join(process.cwd(), 'processos_resultado.csv');

  const content = fs.readFileSync(inputPath, 'utf8');

  let rows = parse(content, {
    delimiter: ';',
    skip_empty_lines: true
  });

  rows = applyResultsToRows(rows, results);
  rows = markDuplicatesInRows(rows);

  const csv = stringify(rows, {
    delimiter: ';'
  });

  fs.writeFileSync(outputPath, csv);

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
// async function checkBatchDatas(codes, dateStr) {
//   return Promise.all(codes.map(code => checkProcess(code, dateStr)));
// }

async function checkBatchDatas(codes, dateFrom, dateTo) {
  console.log('\n========== CHECK BATCH DATAS ==========');
  console.log('CHECK BATCH DATAS');
  console.log('dateFrom:', dateFrom);
  console.log('dateTo:', dateTo);
  return Promise.all(codes.map(code => checkProcess(code, dateFrom, dateTo)));
}

/**
 * Processa um arquivo Excel enviado pelo usuário
 * e retorna o buffer da planilha de resultados.
 */
async function runChecksFromBuffer(buffer) {
  const dateStr = getTodayBR();
  const { rows, codes } = readProcessCodesFromBuffer(buffer);

  if (codes.length === 0) {
    throw new Error('Nenhum código de processo encontrado na planilha.');
  }

  console.log(`📅 Data de hoje (BR): ${dateStr}`);
  console.log(`📋 ${codes.length} processo(s) encontrado(s)\n`);

  const results = await checkAllProcesses(codes, dateStr);

  let updatedRows = applyResultsToRows(rows, results);
  updatedRows = markDuplicatesInRows(updatedRows);

  const csvContent = stringify(updatedRows, {
    delimiter: ';'
  });

  const outputBuffer = Buffer.from(csvContent, 'utf8');

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

  saveResultsCsv(results);

  return { date: dateStr, results };
}

module.exports = {
  runChecks,
  runChecksFromBuffer,
  checkBatchDatas,
};
