const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

/**
 * Resume-as-Code PDF Generator
 * - Headless Chrome / Puppeteer engine
 * - Enforces A4 format and removes unneeded browser margins
 * - Validates page count with pdf-lib
 * - Alerts when 1-page constraints are breached
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    maxPages: null,
    strict: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' || arg === '-i') {
      options.input = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--max-pages' || arg === '-m') {
      options.maxPages = parseInt(args[++i], 10);
    } else if (arg === '--strict' || arg === '-s') {
      options.strict = true;
    } else if (!options.input && !arg.startsWith('-')) {
      options.input = arg;
    } else if (!options.output && !arg.startsWith('-')) {
      options.output = arg;
    }
  }

  return options;
}

async function generatePdf() {
  const options = parseArgs();

  if (!options.input) {
    console.error('❌ Erro: Caminho do arquivo de entrada não especificado.');
    console.log('Uso: node automation/generate_pdf.js --input <caminho.html> [--output <caminho.pdf>] [--max-pages 1] [--strict]');
    process.exit(1);
  }

  const absInputPath = path.resolve(options.input);
  if (!fs.existsSync(absInputPath)) {
    console.error(`❌ Erro: Arquivo de entrada não encontrado: ${absInputPath}`);
    process.exit(1);
  }

  // Se output não for fornecido, substitui extensão .html por .pdf
  const absOutputPath = options.output
    ? path.resolve(options.output)
    : absInputPath.replace(/\.html?$/i, '.pdf');

  // Garante diretório de destino
  const outputDir = path.dirname(absOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Detecta se é um currículo em archives (onde o limite padrão deve ser 1 página)
  const isArchiveResume = absInputPath.includes(path.sep + 'archives' + path.sep) || absInputPath.includes('/archives/');
  const maxPages = options.maxPages !== null ? options.maxPages : (isArchiveResume ? 1 : null);

  console.log('📄 Processando:', absInputPath);
  console.log('🎯 Destino:', absOutputPath);
  if (maxPages) {
    console.log(`📏 Limite de páginas configurado: ${maxPages}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    const fileUrl = 'file:///' + absInputPath.replace(/\\/g, '/');
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Injeta CSS @page para garantir corte exato A4 sem margens padrão do navegador
    await page.addStyleTag({
      content: `
        @page {
          size: A4 portrait;
          margin: 0;
        }
      `
    });

    // Mede dimensões do DOM para diagnóstico de overflow
    const domMetrics = await page.evaluate(() => {
      const el = document.getElementById('resume-container') || document.body;
      return {
        scrollHeight: el.scrollHeight,
        offsetHeight: el.offsetHeight,
        bodyScrollHeight: document.documentElement.scrollHeight
      };
    });

    const pdfBuffer = await page.pdf({
      path: absOutputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      preferCSSPageSize: true
    });

    // Validar páginas usando pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const actualPages = pdfDoc.getPageCount();
    const fileSizeKb = (fs.statSync(absOutputPath).size / 1024).toFixed(1);

    console.log(`\n📊 Relatório de Geração:`);
    console.log(`- Páginas geradas: ${actualPages}`);
    console.log(`- Tamanho do PDF: ${fileSizeKb} KB`);
    console.log(`- Altura DOM renderizada: ${domMetrics.scrollHeight}px (A4 ideal ~ 1122px)`);

    if (maxPages && actualPages > maxPages) {
      const overflowRatio = (domMetrics.scrollHeight / 1122.5).toFixed(2);
      console.warn(`\n⚠️  ATENÇÃO: VIOLAÇÃO DE LIMITE DE PÁGINAS!`);
      console.warn(`O currículo gerou ${actualPages} páginas (limite permitido: ${maxPages}).`);
      console.warn(`Proporção de altura DOM: ${overflowRatio}x de uma página A4.`);
      console.warn(`Dica de ajuste:`);
      console.warn(`  1. Reduza o padding do container (ex: 0.4in ou 8-10mm).`);
      console.warn(`  2. Reduza ligeiramente o font-size do body (ex: 9.2pt - 9.5pt) e line-height (1.25 - 1.3).`);
      console.warn(`  3. Filtre 1 ou 2 bullets secundários de experiências antigas.`);

      if (options.strict) {
        process.exit(2);
      }
    } else {
      console.log(`\n✅ Sucesso: PDF gerado dentro dos limites estabelecidos (${actualPages} página(s))!`);
    }

  } catch (err) {
    console.error('❌ Erro durante a geração do PDF:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generatePdf();
