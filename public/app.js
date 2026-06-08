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
  if (!['xlsx', 'xls'].includes(ext)) {
    alert('Selecione um arquivo Excel (.xlsx ou .xls).');
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

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function extractCodes(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const codes = [];

  for (const row of rows.slice(1)) {
    if (row && row[1] !== undefined && row[1] !== null && row[1] !== '') {
      codes.push(String(row[1]).trim());
    }
  }

  return codes;
}

function applyResultsToWorkbook(wb, results) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows[0]) rows[0] = [];
  rows[0][2] = 'check';

  results.forEach((result, index) => {
    const rowIndex = index + 1;
    if (!rows[rowIndex]) rows[rowIndex] = [];
    rows[rowIndex][2] = result.found ? 'sim' : 'nao';
  });

  wb.Sheets[wb.SheetNames[0]] = XLSX.utils.aoa_to_sheet(rows);
}

function markDuplicatesInWorkbook(wb) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
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

  wb.Sheets[wb.SheetNames[0]] = XLSX.utils.aoa_to_sheet([header, ...data]);
}

function workbookToBlob(wb) {
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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
    const wb = await readWorkbook(selectedFile);
    const codes = extractCodes(wb);

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

    applyResultsToWorkbook(wb, allResults);
    markDuplicatesInWorkbook(wb);

    resultBlob = workbookToBlob(wb);

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
  a.download = 'processos_resultado.xlsx';
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
