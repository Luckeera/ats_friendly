const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { defaultStore } = require('./job_store');

/**
 * Queue Processor
 * - Processes jobs marked in queue (score >= 90% or manually approved via Dashboard)
 * - Generates tailored single-page HTML resume and compiles PDF with 1-page validation
 * - Updates JobStore status and preview links
 */

function buildTailoredResumeHtml(masterHtml, job) {
  let html = masterHtml;

  // 1. Injeta título da vaga se disponível
  if (job.title) {
    html = html.replace(/<div class="title">[\s\S]*?<\/div>/i, `<div class="title">${job.title} | Engenheiro de Software</div>`);
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>Lucas Valente - ${job.company || 'Candidatura'}</title>`);
  }

  // 2. Garante regras de estilo calibradas para 1 página A4
  const singlePageCss = `
        @page {
            size: A4 portrait;
            margin: 0;
        }

        body {
            font-family: Arial, sans-serif;
            line-height: 1.25;
            color: #000;
            background: #f5f5f5;
            font-size: 9.3pt;
        }

        .container {
            max-width: 210mm;
            margin: 0 auto;
            background: #fff;
            padding: 0.38in;
            min-height: 297mm;
            position: relative;
        }

        @media print {
            body { background: #fff; }
            .container {
                padding: 0.35in;
                margin: 0;
                min-height: auto;
            }
            .job, .project, .education-item {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
  `;

  // Substitui ou injeta regras
  if (!html.includes('@page {')) {
    html = html.replace('</style>', `${singlePageCss}\n</style>`);
  }

  return html;
}

async function processQueue(options = {}) {
  const store = options.store || defaultStore;
  const masterPath = options.masterPath || path.resolve(__dirname, '../src/master/v3/master_resume.html');
  const archivesDir = options.archivesDir || path.resolve(__dirname, '../archives');

  const queuedJobs = store.getQueuedJobs();
  console.log(`\n📬 Fila de Geração: ${queuedJobs.length} vaga(s) encontrada(s) para processar.`);

  if (queuedJobs.length === 0) {
    console.log('ℹ️ Nenhuma vaga pendente na fila. Adicione vagas pelo painel web (http://localhost:3000) ou rode a busca.');
    return [];
  }

  const masterHtml = fs.readFileSync(masterPath, 'utf-8');
  const results = [];
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

  for (const job of queuedJobs) {
    const safeCompany = (job.company || 'Vaga').replace(/[^a-zA-Z0-9_-]/g, '_');
    const jobFolder = path.join(archivesDir, `${safeCompany}_${dateStr}`);
    if (!fs.existsSync(jobFolder)) {
      fs.mkdirSync(jobFolder, { recursive: true });
    }

    const htmlFileName = `resume_${safeCompany.toLowerCase()}.html`;
    const pdfFileName = `resume_${safeCompany.toLowerCase()}.pdf`;
    const htmlPath = path.join(jobFolder, htmlFileName);
    const pdfPath = path.join(jobFolder, pdfFileName);

    console.log(`\n⚙️  Processando: ${job.title} (${job.company})...`);
    store.updateJobProgress(job.id, 'Gerando Currículo...');

    // 1. Gera HTML sob medida
    const tailoredHtml = buildTailoredResumeHtml(masterHtml, job);
    fs.writeFileSync(htmlPath, tailoredHtml, 'utf-8');

    // 2. Compila PDF com validação de 1 página via generate_pdf.js
    try {
      const generateScript = path.resolve(__dirname, 'generate_pdf.js');
      execSync(`node "${generateScript}" --input "${htmlPath}" --output "${pdfPath}" --max-pages 1`, {
        stdio: 'inherit'
      });

      // 3. Marca como concluído no store
      store.markJobCompleted(job.id, {
        htmlPath: path.relative(path.resolve(__dirname, '..'), htmlPath).replace(/\\/g, '/'),
        pdfPath: path.relative(path.resolve(__dirname, '..'), pdfPath).replace(/\\/g, '/')
      });

      console.log(`✅ Sucesso! Currículo gerado para ${job.company}`);
      results.push({ job, success: true, htmlPath, pdfPath });
    } catch (err) {
      console.error(`❌ Erro ao compilar PDF para ${job.company}:`, err.message);
      store.updateJobProgress(job.id, 'Erro na Geração');
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
  buildTailoredResumeHtml,
  processQueue
};
