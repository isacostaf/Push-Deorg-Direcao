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
const lastUploadEl = document.getElementById('last-upload');
const lastExportEl = document.getElementById('last-export');

const BATCH_SIZE = 5;

let selectedFile = null;
let resultBlob = null;

async function fetchTimestamps() {
  try {
    const response = await fetch('/api/timestamps');
    const data = await response.json();
    lastUploadEl.textContent = data.lastUpload || '-';
    lastExportEl.textContent = data.lastExport || '-';
  } catch (err) {
    console.error('Erro ao buscar timestamps:', err);
  }
}

async function recordExport() {
  try {
    await fetch('/api/record-export', { method: 'POST' });
    await fetchTimestamps();
  } catch (err) {
    console.error('Erro ao registrar export:', err);
  }
}

function showSection(section) {
  [uploadSection, loadingSection, resultSection, errorSection].forEach(el => {
    el.classList.add('hidden');
  });
  section.classList.remove('hidden');
}

function setFile(file) {
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv'].includes(ext)) {
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

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = text.split('\n').map(line => {
          const result = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        });
        resolve(rows.filter(row => row.length > 0));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function extractCodes(rows) {
  const codes = [];

  for (const row of rows.slice(1)) {
    if (row && row[1] !== undefined && row[1] !== null && row[1] !== '') {
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

function rowsToCSV(rows) {
  return rows.map(row => {
    return row.map(cell => {
      if (cell === undefined || cell === null) return '';
      const str = String(cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  }).join('\n');
}

function csvToBlob(csv) {
  return new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
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
    const rows = await parseCSV(selectedFile);
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

    const csv = rowsToCSV(updatedRows);
    resultBlob = csvToBlob(csv);

    const found = allResults.filter(r => r.found).length;
    resultStats.textContent = `Data: ${dateStr} · ${found} de ${codes.length} processo(s) publicado(s) no DOU.`;
    await fetchTimestamps();
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

  recordExport();
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

fetchTimestamps();
