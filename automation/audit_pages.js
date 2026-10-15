const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

/**
 * Audit script for verifying page constraints across all resumes
 * - Archives resumes must be exactly 1 page
 * - Master resumes can be multi-page
 */

function findPdfs(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(findPdfs(fullPath));
    } else if (item.name.toLowerCase().endsWith('.pdf')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function audit() {
  console.log('🔍 Iniciando Auditoria de Páginas de Currículos...\n');

  const cwd = process.cwd();
  const archivesDir = path.join(cwd, 'archives');
  const masterDir = path.join(cwd, 'src', 'master');

  const archivePdfs = findPdfs(archivesDir);
  const masterPdfs = findPdfs(masterDir);

  let archiveViolations = 0;

  console.log('📂 CURRÍCULOS ARQUIVADOS (Regra de Ouro: Exatamente 1 página):');
  console.log('='.repeat(80));

  for (const pdfPath of archivePdfs) {
    const relative = path.relative(cwd, pdfPath);
    try {
      const buf = fs.readFileSync(pdfPath);
      const doc = await PDFDocument.load(buf);
      const count = doc.getPageCount();
      const status = count === 1 ? '✅ OK (1 pág)' : `❌ VIOLAÇÃO (${count} págs)`;
      if (count > 1) archiveViolations++;
      console.log(`${relative.padEnd(65)} ${status}`);
    } catch (err) {
      console.log(`${relative.padEnd(65)} ⚠️ ERRO AO LER (${err.message})`);
    }
  }

  console.log('\n📂 CURRÍCULOS MESTRE (Fonte da Verdade - sem limite de 1 pág):');
  console.log('='.repeat(80));

  for (const pdfPath of masterPdfs) {
    const relative = path.relative(cwd, pdfPath);
    try {
      const buf = fs.readFileSync(pdfPath);
      const doc = await PDFDocument.load(buf);
      const count = doc.getPageCount();
      console.log(`${relative.padEnd(65)} ℹ️  ${count} páginas`);
    } catch (err) {
      console.log(`${relative.padEnd(65)} ⚠️ ERRO AO LER (${err.message})`);
    }
  }

  console.log('\n' + '='.repeat(80));
  if (archiveViolations > 0) {
    console.log(`⚠️  Auditoria concluída com ${archiveViolations} currículo(s) em /archives violando a regra de 1 página.`);
    console.log(`💡 Para corrigir, calibre os paddings/fontes e selecione apenas os pontos relevantes para cada vaga.`);
  } else {
    console.log('🎉 Parabéns! Todos os currículos em /archives respeitam o limite de 1 página.');
  }
}

audit();
