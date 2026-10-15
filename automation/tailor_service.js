const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { defaultStore } = require('./job_store');
const { getAiProvider } = require('./ai_provider');

/**
 * Tailor Service
 * - Decoupled orchestration layer between trigger (CLI agent, REST API, Web UI) and generation
 * - Uses pluggable AI Provider to adapt resume content
 * - Enforces single-page PDF constraint and updates JobStore
 */

async function tailorJobResume(options = {}) {
  const {
    jobId,
    store = defaultStore,
    aiProvider = getAiProvider(),
    masterPath = path.resolve(__dirname, '../src/master/v3/master_resume.html'),
    archivesDir = path.resolve(__dirname, '../archives')
  } = options;

  const job = store.getJobById(jobId);
  if (!job) {
    throw new Error(`Vaga com ID "${jobId}" não encontrada no JobStore.`);
  }

  const safeCompany = (job.company || 'Vaga').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const jobFolder = path.join(archivesDir, `${safeCompany}_${dateStr}`);

  if (!fs.existsSync(jobFolder)) {
    fs.mkdirSync(jobFolder, { recursive: true });
  }

  const htmlFileName = `resume_${safeCompany.toLowerCase()}.html`;
  const pdfFileName = `resume_${safeCompany.toLowerCase()}.pdf`;
  const htmlPath = path.join(jobFolder, htmlFileName);
  const pdfPath = path.join(jobFolder, pdfFileName);

  console.log(`\n🤖 [TailorService] Adaptando currículo para: ${job.title} (${job.company})...`);
  store.updateJobProgress(job.id, 'Gerando Currículo...');

  const masterHtml = fs.readFileSync(masterPath, 'utf-8');

  // 1. Adaptação via AI Provider (Local, Gemini, OpenAI, etc.)
  const tailoredHtml = await aiProvider.tailorResume({
    masterHtml,
    job,
    matchedSkills: job.matchedSkills || []
  });
  fs.writeFileSync(htmlPath, tailoredHtml, 'utf-8');

  // 2. Compilação e validação do PDF de 1 página
  const generateScript = path.resolve(__dirname, 'generate_pdf.js');
  try {
    execSync(`node "${generateScript}" --input "${htmlPath}" --output "${pdfPath}" --max-pages 1`, {
      stdio: 'inherit'
    });

    const rootDir = path.resolve(__dirname, '..');
    const relHtmlPath = path.relative(rootDir, htmlPath).replace(/\\/g, '/');
    const relPdfPath = path.relative(rootDir, pdfPath).replace(/\\/g, '/');

    // 3. Atualiza estado para concluído
    store.markJobCompleted(job.id, {
      htmlPath: relHtmlPath,
      pdfPath: relPdfPath
    });

    console.log(`✅ [TailorService] Sucesso: Currículo gerado para ${job.company}`);
    return {
      success: true,
      jobId: job.id,
      htmlPath,
      pdfPath,
      relHtmlPath,
      relPdfPath
    };
  } catch (err) {
    console.error(`❌ [TailorService] Erro ao gerar PDF: ${err.message}`);
    store.updateJobProgress(job.id, 'Erro na Geração');
    throw err;
  }
}

module.exports = {
  tailorJobResume
};
