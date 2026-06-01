# Representacoes-AA (Node.js + EJS)

Aplicacao web para buscar e analisar publicacoes do DOU, com classificacao de chance de representacao e envio de relatorios.

## Visao geral
Esta aplicacao oferece uma interface web (EJS) e um backend Express para:
- executar buscas por data no DOU;
- analisar o conteudo com regras de pontuacao;
- classificar resultados e gerar CSV;
- baixar PDFs dos documentos classificados;
- agendar rotinas automaticas e enviar e-mails.

## Stack
- Front-end: EJS
- Back-end: Node.js + Express
- Automacao e PDF: Puppeteer + pdf-lib
- Integracoes: Supabase (usuarios + controle), SMTP (email)

## Fluxo principal
1. Usuario informa intervalo de datas na interface.
2. O sistema monta a busca no DOU e coleta links paginados.
3. Cada link e analisado por regras de pontuacao.
4. O relatorio filtra itens com classificacao minima.
5. O CSV e salvo e os PDFs sao gerados.
6. O usuario pode baixar CSV e ZIPs por categoria.

## Classificacao
A classificacao e baseada em duas pontuacoes:
- `Score Base`: soma de pesos positivos e negativos.
- `Score Representacao`: deteccao de padroes de representacao.

Regra atual:
- Alta probabilidade: `Score Representacao >= 8`, nao bloqueado e `Score Base > -1`
- Baixa probabilidade: `Score Base > 2` ou `Score Representacao >= 8`
- Extra-baixa: demais casos (nao entra no relatorio final)

## Rotas HTTP
Web:
- `GET /`: formulario inicial
- `POST /process`: executa busca, analise e gera downloads
- `POST /subscribe`: cadastro de destinatario de email

Downloads:
- `GET /download/csv/:runId`: baixa CSV da execucao
- `GET /download/zip/:runId/alta`: baixa ZIP com PDFs de alta
- `GET /download/zip/:runId/baixa`: baixa ZIP com PDFs de baixa

Email (nao exposto na UI):
- `POST /email/:runId`: envia email manual da execucao

## Cron (Vercel)
As rotinas automaticas estao em:
- `GET /api/cronManha`
- `GET /api/cronNoite`

O agendamento esta definido em `vercel.json`:
- `0 11 * * *`
- `0 23 * * *`

O cron:
- gera relatorio do dia corrente;
- calcula hash do relatorio;
- compara com o hash salvo no Supabase;
- envia email apenas se houver mudanca.

## Supabase
Tabelas esperadas:
- `usuarios`: lista de destinatarios de email
- `controle_execucao`: controle de hash por data
- `pendencias_envio`: fila de envios (data, status, csv_path, pdf_paths, linhas)

Observacao: o cadastro exige email institucional do MD (regra no banco).

## Armazenamento de arquivos
Os arquivos de cada execucao ficam em um diretorio temporario:
- base: `os.tmpdir()/representacoes-aa`
- subpastas: `pdfs/alta_probabilidade` e `pdfs/baixa_probabilidade`
- CSV: `relatorio.csv`

Em Vercel, o armazenamento deve ser feito em `/tmp`.

## Estrutura do projeto (alto nivel)
- `server.js`: entrada local
- `api/`: entrada serverless (Vercel)
- `src/`: servicos, utils, config
- `views/`: templates EJS
- `public/`: assets estaticos
- `analises/`: documentos auxiliares

## Como rodar localmente
1. Instale as dependencias:
   `npm install`
2. Configure variaveis de ambiente:
   copie `modelo.env` para `.env` e preencha os valores
3. Inicie em modo desenvolvimento:
   `npm run dev`
4. Acesse:
   `http://localhost:3000`

## Scripts
- `npm run dev`: servidor local com hot reload (nodemon)
- `npm start`: servidor local sem hot reload

## Variaveis de ambiente
Defina em `.env` (base: `modelo.env`).

SMTP (obrigatorio para envio de email):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `EMAIL_FROM`

Supabase (obrigatorio para cadastro e cron):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (bucket do Storage para CSV/PDF)

## Deploy na Vercel
- Entrada serverless: `api/index.js`
- Rotas e crons: `vercel.json`
- Em ambiente Vercel, os arquivos temporarios sao gerados em `/tmp`

## Troubleshooting rapido
- Erro de email: valide SMTP e se ha destinatarios no Supabase.
- Erro de PDF/Puppeteer: confirme permissao de escrita em `/tmp`.
- Nenhum resultado: revise o intervalo de datas e a disponibilidade do DOU.

## Requisitos
- Node.js `>=20`

## Licenca
Uso restrito. Este codigo nao pode ser utilizado por terceiros sem autorizacao expressa do titular.
# Push-Deorg-Direcao
# Push-Deorg-Direcao
