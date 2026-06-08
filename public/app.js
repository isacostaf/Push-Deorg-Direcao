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
  showSection(uploadSection);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFile() {
  if (!selectedFile) return;

  showSection(loadingSection);

  try {
    const base64 = await fileToBase64(selectedFile);

    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: base64 }),
    });

    if (!response.ok) {
      let message = 'Erro ao processar a planilha.';
      try {
        const data = await response.json();
        message = data.error || message;
      } catch {
        // resposta não é JSON
      }
      throw new Error(message);
    }

    resultBlob = await response.blob();

    const date = response.headers.get('X-Process-Date') || '';
    const total = response.headers.get('X-Total-Processes') || '?';
    const found = response.headers.get('X-Found-Count') || '?';

    resultStats.textContent = `Data: ${date} · ${found} de ${total} processo(s) publicado(s) no DOU.`;
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
