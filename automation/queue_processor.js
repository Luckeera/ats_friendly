const { defaultStore } = require('./job_store');
const { tailorJobResume } = require('./tailor_service');
const { getAiProvider } = require('./ai_provider');

/**
 * Queue Processor
 * - Processes jobs marked in queue (score >= 90% or manually approved via Dashboard)
 * - Uses TailorService and configured AI Provider to generate 1-page resumes
 */

async function processQueue(options = {}) {
  const store = options.store || defaultStore;
  const aiProvider = options.aiProvider || getAiProvider();

  const queuedJobs = store.getQueuedJobs();
  console.log(`\n📬 Fila de Geração: ${queuedJobs.length} vaga(s) encontrada(s) para processar.`);

  if (queuedJobs.length === 0) {
    console.log('ℹ️ Nenhuma vaga pendente na fila. Adicione vagas pelo painel web (http://localhost:3000) ou rode a busca.');
    return [];
  }

  const results = [];

  for (const job of queuedJobs) {
    try {
      const result = await tailorJobResume({
        jobId: job.id,
        store,
        aiProvider
      });
      results.push(result);
    } catch (err) {
      console.error(`❌ Erro ao processar vaga ${job.company}: ${err.message}`);
      results.push({ job, success: false, error: err.message });
    }
  }

  return results;
}

if (require.main === module) {
  processQueue().catch(err => {
    console.error('❌ Falha ao processar fila:', err);
    process.exit(1);
  });
}

module.exports = {
  processQueue
};

