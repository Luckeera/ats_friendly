const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { extractProfile, calculateMatch, detectApplicationType } = require('./match_engine');
const { saveJobsToCsv } = require('./spreadsheet_manager');

/**
 * LinkedIn Hunter Module
 * - Searches public/guest LinkedIn job listings without authentication
 * - Extracts structured metadata (title, company, location, link, isEasyApply, description)
 * - Computes match score against master resume
 * - Saves and sorts jobs in CSV
 */

function buildSearchUrl(keyword, location = 'Brasil', timeWindow = 'week') {
  // f_TPR: r86400 (últimas 24h), r604800 (última semana), r2592000 (último mês)
  const timeParam = timeWindow === 'day' ? 'r86400' : 'r604800';
  const encodedKw = encodeURIComponent(keyword);
  const encodedLoc = encodeURIComponent(location);
  return `https://www.linkedin.com/jobs/search?keywords=${encodedKw}&location=${encodedLoc}&geoId=106057199&f_TPR=${timeParam}`;
}

function parseCardHtml(cardHtml) {
  const titleMatch = cardHtml.match(/class="base-search-card__title">([\s\S]*?)<\/h3>/i);
  const companyMatch = cardHtml.match(/class="base-search-card__subtitle">([\s\S]*?)<\/h4>/i);
  const locationMatch = cardHtml.match(/class="job-search-card__location">([\s\S]*?)<\/span>/i);
  const linkMatch = cardHtml.match(/class="base-card__full-link"[^>]*href="([^"]+)"/i);
  const timeMatch = cardHtml.match(/class="job-search-card__listdate[^"]*">([\s\S]*?)<\/time>/i);

  const cleanText = (str) => str ? str.replace(/<[^>]+>/g, '').trim() : '';

  return {
    title: cleanText(titleMatch ? titleMatch[1] : ''),
    company: cleanText(companyMatch ? companyMatch[1] : ''),
    location: cleanText(locationMatch ? locationMatch[1] : ''),
    link: linkMatch ? linkMatch[1].split('?')[0] : '', // link limpo sem trackers
    posted: cleanText(timeMatch ? timeMatch[1] : '')
  };
}

function parseJobDetails(pageHtml) {
  const descMatch = pageHtml.match(/class="(?:show-more-less-html__markup|description__text)[^"]*">([\s\S]*?)<\/div>/i);
  const rawDesc = descMatch ? descMatch[1] : pageHtml;
  const cleanDesc = rawDesc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const applyType = detectApplicationType(pageHtml);

  return {
    description: cleanDesc,
    applyType
  };
}

async function scrapeJobSearch(page, searchUrl, maxJobs = 5) {
  console.log(`🔎 Acessando: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.base-card', { timeout: 10000 }).catch(() => null);

  const cardsHtml = await page.evaluate((max) => {
    const cards = document.querySelectorAll('.base-card, .job-search-card');
    return Array.from(cards).slice(0, max).map(c => c.outerHTML);
  }, maxJobs);

  return cardsHtml.map(html => parseCardHtml(html)).filter(j => j.title && j.link);
}

async function scrapeJobPage(page, jobUrl) {
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.show-more-less-html__markup, .description__text', { timeout: 8000 }).catch(() => null);

  const pageHtml = await page.content();
  return parseJobDetails(pageHtml);
}

async function huntLinkedInJobs(options = {}) {
  const {
    keywords = [
      'Desenvolvedor Python Junior',
      'Engenheiro de Dados Junior',
      'Desenvolvedor Fullstack Node React'
    ],
    location = 'Brasil',
    timeWindow = 'week',
    maxPerKeyword = 3,
    masterResumePath = path.resolve(__dirname, '../src/master/v3/master_resume.html'),
    csvOutputPath = path.resolve(__dirname, '../vagas.csv')
  } = options;

  console.log('🚀 Iniciando LinkedIn Hunter (Modo On-Demand / Guest)...');

  // Carrega e extrai perfil do candidato
  const masterHtml = fs.readFileSync(masterResumePath, 'utf-8');
  const candidateProfile = extractProfile(masterHtml);
  console.log(`👤 Perfil carregado: ${candidateProfile.title || 'Candidato'}`);
  console.log(`🛠️  Skills mapeadas no currículo: ${candidateProfile.skills.length} tecnologias`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const processedJobs = [];

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const kw of keywords) {
      const url = buildSearchUrl(kw, location, timeWindow);
      const cards = await scrapeJobSearch(page, url, maxPerKeyword);
      console.log(`📋 Encontradas ${cards.length} vagas para "${kw}"`);

      for (const card of cards) {
        try {
          console.log(`  ➔ Inspecionando: ${card.title} em ${card.company}...`);
          const details = await scrapeJobPage(page, card.link);

          // Calcula match
          const matchResult = calculateMatch(details.description, candidateProfile);

          const jobRecord = {
            title: card.title,
            company: card.company,
            location: card.location,
            link: card.link,
            posted: card.posted,
            applyType: details.applyType,
            score: matchResult.score,
            matchedSkills: matchResult.matchedSkills,
            missingSkills: matchResult.missingSkills,
            status: matchResult.isTopMatch ? 'Pendente (Match 90%+)' : 'Pendente',
            description: details.description.slice(0, 1000)
          };

          processedJobs.push(jobRecord);
        } catch (err) {
          console.warn(`  ⚠️ Falha ao inspecionar vaga ${card.title}: ${err.message}`);
        }
      }
    }

    // Salva na planilha CSV
    if (processedJobs.length > 0) {
      saveJobsToCsv(processedJobs, csvOutputPath);
      console.log(`\n💾 ${processedJobs.length} vagas salvas e ordenadas em: ${csvOutputPath}`);
    }

    return processedJobs;
  } finally {
    await browser.close();
  }
}

// Suporte para execução direta via CLI
if (require.main === module) {
  huntLinkedInJobs().catch(err => {
    console.error('❌ Erro durante o scraping:', err);
    process.exit(1);
  });
}

module.exports = {
  buildSearchUrl,
  parseCardHtml,
  parseJobDetails,
  huntLinkedInJobs
};
