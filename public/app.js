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
const loadingTitle = document.getElementById('loading-title');
const loadingHint = document.getElementById('loading-hint');
const stepCheck = document.getElementById('step-check');
const stepEmail = document.getElementById('step-email');

const BATCH_SIZE = 5;

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
  resetLoadingPhase();
  showSection(uploadSection);
}

function resetLoadingPhase() {
  loadingTitle.textContent = 'Consultando processos no DOU...';
  loadingHint.textContent = 'Planilhas grandes são processadas em lotes. Não feche esta página.';
  progressFill.classList.remove('shimmer');
  stepCheck.classList.add('active');
  stepCheck.classList.remove('done');
  stepCheck.querySelector('.step-num').textContent = '1';
  stepEmail.classList.remove('active');
}

function setEmailPhase() {
  loadingTitle.textContent = 'Enviando e-mail com os resultados...';
  loadingHint.textContent = 'Aguarde enquanto o e-mail é preparado e enviado.';
  loadingProgress.textContent = 'Preparando envio...';
  progressFill.classList.add('shimmer');
  stepCheck.classList.remove('active');
  stepCheck.classList.add('done');
  stepCheck.querySelector('.step-num').textContent = '✓';
  stepEmail.classList.add('active');
}

function updateProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  loadingProgress.textContent = `${done} / ${total} processos`;
}

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .map(line => line.split(','));
}

function extractCodes(rows) {
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

function applyResultsToRows(rows, results) {
  if (!rows[0]) rows[0] = [];

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

function rowsToCsv(rows) {
  return rows.map(row => row.join(',')).join('\n');
}

async function checkBatch(codes) {
  const response = await fetch('/api/check-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codes }),
  });

  if (!response.ok) {
    let message = 'Erro ao consultar o DOU.';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // resposta não é JSON
    }
    throw new Error(message);
  }

  return response.json();
}

async function processFile() {
  if (!selectedFile) return;

  showSection(loadingSection);

  try {
    const csvText = await selectedFile.text();

    const rows = parseCsv(csvText);

    const codes = extractCodes(rows);

    if (codes.length === 0) {
      throw new Error('Nenhum código de processo encontrado na coluna B.');
    }

    updateProgress(0, codes.length);

    const allResults = [];
    let dateStr = '';

    for (let i = 0; i < codes.length; i += BATCH_SIZE) {
      const batch = codes.slice(i, i + BATCH_SIZE);
      const { date, results } = await checkBatch(batch);

      dateStr = date;
      allResults.push(...results);
      updateProgress(allResults.length, codes.length);
    }

    let updatedRows = applyResultsToRows(rows, allResults);

    updatedRows = markDuplicatesInRows(updatedRows);

    const csvOutput = rowsToCsv(updatedRows);

    resultBlob = new Blob(
      [csvOutput],
      {
        type: 'text/csv;charset=utf-8'
      }
    );

    setEmailPhase();

    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, results: allResults, csvContent: csvOutput }),
      });
    } catch {
      // Erro no envio do e-mail não bloqueia o resultado
    }

    const found = allResults.filter(r => r.found).length;
    resultStats.textContent = `Data: ${dateStr} · ${found} de ${codes.length} processo(s) publicado(s) no DOU.`;
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
  a.download = 'processos_resultado.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

processBtn.addEventListener('click', processFile);
downloadBtn.addEventListener('click', downloadResult);
resetBtn.addEventListener('click', reset);
retryBtn.addEventListener('click', reset);
