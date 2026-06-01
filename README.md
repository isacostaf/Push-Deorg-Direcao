# 📰 Monitor DOU

Roda automaticamente todo dia útil às **8h (horário de Brasília)** no Vercel.

Lê os códigos de processo da coluna B do arquivo `processos.xlsx`, consulta o
[Diário Oficial da União](https://www.in.gov.br) e envia um e-mail com o resumo.

---

## 📁 Estrutura do projeto

```
dou-monitor/
├── api/
│   └── cron/
│       └── check.js        ← Endpoint chamado pelo Vercel Cron
├── src/
│   ├── checker.js          ← Lógica de consulta ao DOU
│   └── mailer.js           ← Envio de e-mail
├── processos.xlsx          ← Sua planilha (coluna B = códigos de processo)
├── index.js                ← Ponto de entrada para rodar localmente
├── vercel.json             ← Configuração do Cron (08:00 BRT = 11:00 UTC)
├── package.json
├── .env.example
└── .gitignore
```

---

## 🗂️ Planilha `processos.xlsx`

A **coluna B** deve conter os códigos de processo, um por linha.  
A coluna A pode ser usada para nomes/descrições (opcional).

| A (descrição) | B (código) |
|---|---|
| Processo ANVISA | 60080.000222/2025-78 |
| Licença IBAMA   | 02001.001234/2024-11 |

> A primeira linha pode ser um cabeçalho — células vazias na coluna B são ignoradas.

---

## ⚙️ Configuração

### 1. Clone e instale as dependências

```bash
git clone <seu-repo>
cd dou-monitor
npm install
```

### 2. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha:

```bash
cp .env.example .env
```

Edite `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@gmail.com
SMTP_PASS=sua_app_password   # App Password do Google
EMAIL_TO=seuemail@gmail.com
CRON_SECRET=token_secreto_aleatorio
```

**App Password do Gmail:**
1. Acesse: https://myaccount.google.com/apppasswords
2. Crie um app password para "Email / Outro"
3. Use a senha gerada no campo `SMTP_PASS`

**Gerar CRON_SECRET:**
```bash
openssl rand -hex 32
```

### 3. Adicione sua planilha

Coloque o arquivo `processos.xlsx` na raiz do projeto.

---

## 🧪 Testar localmente

```bash
node index.js
```

---

## 🚀 Deploy no Vercel

### 1. Suba o código para o GitHub

```bash
git init
git add .
git commit -m "feat: monitor DOU"
git remote add origin https://github.com/seu-usuario/dou-monitor.git
git push -u origin main
```

### 2. Importe o projeto no Vercel

1. Acesse https://vercel.com/new
2. Importe o repositório do GitHub
3. Clique em **Deploy**

### 3. Configure as variáveis de ambiente no Vercel

Em **Settings → Environment Variables**, adicione todas as variáveis do `.env`:

| Nome | Valor |
|------|-------|
| `SMTP_HOST` | smtp.gmail.com |
| `SMTP_PORT` | 587 |
| `SMTP_SECURE` | false |
| `SMTP_USER` | seuemail@gmail.com |
| `SMTP_PASS` | sua_app_password |
| `EMAIL_TO` | seuemail@gmail.com |
| `CRON_SECRET` | seu_token_secreto |

### 4. Inclua a planilha no repositório

O arquivo `processos.xlsx` **deve estar commitado** no repo para o Vercel conseguir lê-lo.  
Se quiser manter privado, use um repositório privado no GitHub.

---

## ⏰ Agendamento

O `vercel.json` está configurado para:

```json
{ "schedule": "0 11 * * 1-5" }
```

→ **11:00 UTC = 08:00 BRT**, de segunda a sexta.

Para incluir finais de semana, mude para `"0 11 * * *"`.

> ⚠️ Cron Jobs no Vercel requerem o plano **Pro** ou superior.  
> Alternativa gratuita: use o **GitHub Actions** (ver seção abaixo).

---

## 🔄 Alternativa gratuita: GitHub Actions

Se não quiser o plano Pro do Vercel, crie o arquivo `.github/workflows/monitor.yml`:

```yaml
name: Monitor DOU

on:
  schedule:
    - cron: '0 11 * * 1-5'   # 08:00 BRT (seg–sex)
  workflow_dispatch:           # permite rodar manualmente

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: node index.js
        env:
          SMTP_HOST: ${{ secrets.SMTP_HOST }}
          SMTP_PORT: ${{ secrets.SMTP_PORT }}
          SMTP_SECURE: ${{ secrets.SMTP_SECURE }}
          SMTP_USER: ${{ secrets.SMTP_USER }}
          SMTP_PASS: ${{ secrets.SMTP_PASS }}
          EMAIL_TO: ${{ secrets.EMAIL_TO }}
```

Configure os secrets em **Settings → Secrets and variables → Actions** no GitHub.

---

## 📧 Exemplo de e-mail recebido

**Assunto:** `✅ DOU 01-06-2026: 1 processo(s) publicado(s)!`

| Processo | Status | Link |
|---|---|---|
| 60080.000222/2025-78 | ✅ PUBLICADO | Ver no DOU |
| 02001.001234/2024-11 | ❌ Não encontrado | Ver no DOU |
