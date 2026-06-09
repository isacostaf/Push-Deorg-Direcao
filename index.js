const { runChecks } = require('./src/checker');

async function main() {
  console.log('🚀 Iniciando Monitor DOU...\n');

  const { date, results } = await runChecks();

  console.log('\n📊 Resultados:');
  for (const r of results) {
    const status = r.error ? `ERRO: ${r.error}` : r.found ? '✅ PUBLICADO' : '❌ Não encontrado';
    console.log(`  ${r.processCode} → ${status}`);
  }

  console.log('\n✅ Monitor DOU finalizado.');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
