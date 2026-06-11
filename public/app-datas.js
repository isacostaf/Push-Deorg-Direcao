const fileInput = document.getElementById('file-input');
const dropzone = document.getElementById('dropzone');
const fileNameEl = document.getElementById('file-name');
const processBtn = document.getElementById('process-btn');
const uploadSection = document.getElementById('upload-section');
const loadingSection = document.getElementById('loading-section');
const resultSection = document.getElementById('result-section');
const errorSection = document.getElementById('error-section');
const resultStats = document.getElementById('result-stats');
const errorMessage = document.getElementById('error-message');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const retryBtn = document.getElementById('retry-btn');
const progressFill = document.getElementById('progress-fill');
const loadingProgress = document.getElementById('loading-progress');


const BATCH_SIZE = 5;

// // 🔵 NOVO: datas do sistema novo
// const dateFrom = '01-06-2026';
// const dateTo = '10-06-2026';

const dateFromInput = document.getElementById('data-inicio');
const dateToInput = document.getElementById('data-fim');

let selectedFile = null;
let resultBlob = null;

function showSection(section) {
  [uploadSection, loadingSection, resultSection, errorSection].forEach(el => {
    el.classList.add('hidden');
  });
  section.classList.remove('hidden');
}

function setFile(file) {
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'csv') {
    alert('Selecione um arquivo CSV (.csv).');
    return;
  }

  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileNameEl.classList.add('visible');
  processBtn.disabled = false;
}

function reset() {
  selectedFile = null;
  resultBlob = null;
  fileInput.value = '';
  fileNameEl.textContent = '';
  fileNameEl.classList.remove('visible');
  processBtn.disabled = true;
  updateProgress(0, 0);
  showSection(uploadSection);
}

function updateProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  loadingProgress.textContent = `${done} / ${total} processos`;
}

function parseCsv(text) {
  return text.trim().split(/\r?\n/).map(line => line.split(','));
}

function extractCodes(rows) {
  const codes = [];
  for (const row of rows.slice(1)) {
    if (row?.[1]) codes.push(String(row[1]).trim());
  }
  return codes;
}

function applyResultsToRows(rows, results) {
  if (!rows[0]) rows[0] = [];
  rows[0][2] = 'check';

  results.forEach((result, index) => {
    const rowIndex = index + 1;
    if (!rows[rowIndex]) rows[rowIndex] = [];
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
    if (row[2] === 'sim') {
      countMap.set(process, (countMap.get(process) || 0) + 1);
    }
  }

  for (const row of data) {
    const process = row[1];
    if (row[2] === 'sim' && countMap.get(process) > 1) {
      row[2] = 'verificar';
    }
  }

  return [header, ...data];
}

function rowsToCsv(rows) {
  return rows.map(r => r.join(',')).join('\n');
}

// 🔵 NOVA API
async function checkBatch(codes, dateFrom, dateTo) {
  const response = await fetch('/api/check-datas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes, dateFrom, dateTo }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Erro ao consultar datas.');
  }

  return response.json();
}

function formatDateToBR(date) {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

async function processFile() {
  if (!selectedFile) return;

  const dateFrom = dateFromInput.value;
  const dateTo = dateToInput.value;

  if (!dateFrom || !dateTo) {
    throw new Error('Selecione as datas inicial e final.');
  }

  const dateFromBR = formatDateToBR(dateFrom);
  const dateToBR = formatDateToBR(dateTo);

  showSection(loadingSection);

  try {
    const csvText = await selectedFile.text();
    const rows = parseCsv(csvText);
    const codes = extractCodes(rows);

    if (!codes.length) {
      throw new Error('Nenhum código encontrado.');
    }

    updateProgress(0, codes.length);

    const allResults = [];

    for (let i = 0; i < codes.length; i += BATCH_SIZE) {
      const batch = codes.slice(i, i + BATCH_SIZE);

      const { results } = await checkBatch(
        batch,
        dateFromBR,
        dateToBR
      );

      allResults.push(...results);
      updateProgress(allResults.length, codes.length);
    }

    let updatedRows = applyResultsToRows(rows, allResults);
    updatedRows = markDuplicatesInRows(updatedRows);

    const csvOutput = rowsToCsv(updatedRows);

    resultBlob = new Blob(
      [csvOutput],
      { type: 'text/csv;charset=utf-8' }
    );

    const found = allResults.filter(r => r.found).length;

    resultStats.textContent =
      `Período: ${dateFromBR} → ${dateToBR} · ` +
      `${found} de ${codes.length} encontrados`;

    showSection(resultSection);
  } catch (err) {
    errorMessage.textContent = err.message;
    showSection(errorSection);
  }
}

function downloadResult() {
  if (!resultBlob) return;

  const url = URL.createObjectURL(resultBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'processos_resultado_datas.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// eventos
fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
dropzone.addEventListener('dragover', e => { e.preventDefault(); });
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  setFile(e.dataTransfer.files[0]);
});

processBtn.addEventListener('click', processFile);
downloadBtn.addEventListener('click', downloadResult);
resetBtn.addEventListener('click', reset);
retryBtn.addEventListener('click', reset);