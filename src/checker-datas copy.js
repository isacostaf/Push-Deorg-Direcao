const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const path = require('path');
const { runChecks } = require('./checker');

function buildUrl(processCode, datefrom, dateto) {
  const encoded = encodeURIComponent(`" ${processCode}"`);

  return `https://www.in.gov.br/consulta/-/buscar/dou?q=${encoded}&s=todos&exactDate=personalizado&sortType=0&publishFrom=01-06-2026&publishTo=10-06-2026`;
}

function readProcessCodesFromRows(rows) {
  const codes = [];

  for (const row of rows.slice(1)) {
    if (row?.[1]) {
      codes.push(String(row[1]).trim());
    }
  }

  return codes;
}

async function checkProcess(processCode, datefrom, dateto) {
  const url = buildUrl(processCode, datefrom, dateto);



  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (DOU-Monitor)',
        Accept: 'text/html,*/*',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return { processCode, found: false, error: `HTTP ${res.status}` };
    }

    const html = await res.text();

    const noResult =
      html.includes('Nenhum resultado encontrado') ||
      html.includes('nenhum resultado');

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
      found: hasResult,
    };
  } catch (err) {
    return {
      processCode,
      found: false,
      error: err.message,
    };
  }
}

async function checkBatchDatas(codes, datefrom, dateto) {
  return Promise.all(
    codes.map(code => checkProcess(code, datefrom, dateto))
  );
}

module.exports = {
  checkBatchDatas,
  runChecks,
};