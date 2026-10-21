const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { extractProfile, calculateMatch, detectApplicationType } = require('./match_engine');
const { saveJobsToCsv } = require('./spreadsheet_manager');
const { defaultStore } = require('./job_store');
const { getAiProvider } = require('./ai_provider');
const { getLatestMasterResumePath } = require('./master_manager');

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
  const titleMatch = cardHtml.match(/class="[^"]*base-search-card__title[^"]*">([\s\S]*?)<\/h3>/i);
  const companyMatch = cardHtml.match(/class="[^"]*base-search-card__subtitle[^"]*">([\s\S]*?)<\/h4>/i);
  const locationMatch = cardHtml.match(/class="[^"]*job-search-card__location[^"]*">([\s\S]*?)<\/span>/i);
  const linkMatch = cardHtml.match(/<a\b[^>]*\bhref="([^"]+)"[^>]*class="[^"]*base-card__full-link[^"]*"/i) ||
                    cardHtml.match(/<a\b[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*\bhref="([^"]+)"/i) ||
                    cardHtml.match(/href="([^"]*linkedin\.com\/jobs\/view\/[^"]+)"/i);
  const timeMatch = cardHtml.match(/class="[^"]*job-search-card__listdate[^"]*">([\s\S]*?)<\/time>/i);

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

  // Preserva tags semânticas limpas para renderização fiel
  const descriptionHtml = rawDesc
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<(?!\/?(p|br|ul|ol|li|strong|b|em|i|h1|h2|h3|h4|h5|h6)\b)[^>]+>/gi, '')
    .trim();

  const applyType = detectApplicationType(pageHtml);

  return {
    description: cleanDesc,
    descriptionHtml,
    applyType
  };
}

async function scrapeJobSearch(page, searchUrl, maxJobs = 5) {
  console.log(`🔎 Acessando: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.base-card', { timeout: 10000 }).catch(() => null);

  const jobs = await page.evaluate((max) => {
    const cards = document.querySelectorAll('.base-card, .job-search-card');
    return Array.from(cards).slice(0, max).map(c => {
      const titleEl = c.querySelector('.base-search-card__title');
      const companyEl = c.querySelector('.base-search-card__subtitle');
      const locationEl = c.querySelector('.job-search-card__location');
      const linkEl = c.querySelector('a.base-card__full-link') || c.querySelector('a[href*="/jobs/view/"]');
      const timeEl = c.querySelector('time');

      return {
        title: titleEl ? titleEl.innerText.trim() : '',
        company: companyEl ? companyEl.innerText.trim() : '',
        location: locationEl ? locationEl.innerText.trim() : '',
        link: linkEl ? linkEl.href.split('?')[0] : '',
        posted: timeEl ? timeEl.innerText.trim() : ''
      };
    }).filter(j => j.title && j.link);
  }, maxJobs);

  return jobs;
}

async function scrapeJobPage(page, jobUrl) {
  await page.goto(jobUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.show-more-less-html__markup, .description__text', { timeout: 8000 }).catch(() => null);

  const pageHtml = await page.content();
  return parseJobDetails(pageHtml);
}

async function huntLinkedInJobs(options = {}) {
  const {
    aiProvider = getAiProvider(),
    keywords = null,
    location = 'Brasil',
    timeWindow = 'week',
    maxPerKeyword = 3,
    masterResumePath = getLatestMasterResumePath(),
    csvOutputPath = path.resolve(__dirname, '../vagas.csv')
  } = options;

  console.log('🚀 Iniciando LinkedIn Hunter (Modo On-Demand / Guest guiado por IA)...');

  // Carrega e extrai perfil do candidato
  const masterHtml = fs.readFileSync(masterResumePath, 'utf-8');
  const candidateProfile = extractProfile(masterHtml);
  console.log(`👤 Perfil carregado: ${candidateProfile.title || 'Candidato'}`);
  console.log(`🛠️  Skills mapeadas no currículo: ${candidateProfile.skills.length} tecnologias`);

  // IA define a estratégia e os termos de busca caso não fornecidos explicitamente
  const searchKeywords = keywords || (await aiProvider.generateSearchQueries(candidateProfile));
  console.log(`🎯 Estratégia de busca formulada pela IA: [${searchKeywords.join(', ')}]`);

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

    for (const kw of searchKeywords) {
      const url = buildSearchUrl(kw, location, timeWindow);
      const cards = await scrapeJobSearch(page, url, maxPerKeyword);
      console.log(`📋 Encontradas ${cards.length} vagas brutas para "${kw}"`);

      for (const card of cards) {
        try {
          console.log(`  ➔ Inspecionando: ${card.title} em ${card.company}...`);
          const details = await scrapeJobPage(page, card.link);

          // 1. Sinal auxiliar de ferramentas (match heurístico)
          const toolMatch = calculateMatch(details.description, candidateProfile);

          // 2. Leitura semântica e decisão final executada pela IA
          const rawJob = { ...card, ...details };
          const aiDecision = await aiProvider.evaluateJobFit({
            job: rawJob,
            candidateProfile,
            toolMatch
          });

          // Se a IA descartou a vaga (incompatível / ruído)
          if (!aiDecision.shouldAdd) {
            console.log(`  🛑 [Decisão da IA] Descartada: ${card.title} em ${card.company}`);
            console.log(`     Motivo: ${aiDecision.aiReasoning}`);
            continue;
          }

          console.log(`  💡 [Decisão da IA] Aprovada (${aiDecision.score}%): ${aiDecision.aiReasoning}`);

          const jobRecord = {
            title: card.title,
            company: card.company,
            location: card.location,
            link: card.link,
            posted: card.posted,
            applyType: details.applyType,
            score: aiDecision.score,
            aiReasoning: aiDecision.aiReasoning,
            matchedSkills: aiDecision.matchedSkills,
            missingSkills: aiDecision.missingSkills,
            description: details.description.slice(0, 1000),
            descriptionHtml: details.descriptionHtml ? details.descriptionHtml.slice(0, 4000) : '',
            queued: Boolean(aiDecision.queued)
          };

          // Salva no JobStore (atualiza estado e sincroniza CSV)
          const stored = defaultStore.upsertJob(jobRecord);
          processedJobs.push(stored);

          // Se a IA marcou como prioritária na fila, registra para o Agente CLI processar
          if (aiDecision.queued) {
            console.log(`  📬 [Fila do Agente] Vaga priorizada e adicionada à fila para o Agente CLI.`);
          }
        } catch (err) {
          console.warn(`  ⚠️ Falha ao inspecionar vaga ${card.title}: ${err.message}`);
        }
      }
    }

    console.log(`\n💾 ${processedJobs.length} vagas consolidadas no painel e na planilha pela IA.`);
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
