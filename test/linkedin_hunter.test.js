const test = require('node:test');
const assert = require('node:assert');
const { buildSearchUrl, parseCardHtml, parseJobDetails } = require('../automation/linkedin_hunter');

test('TDD: buildSearchUrl should construct valid LinkedIn public search URL', () => {
  const url = buildSearchUrl('Desenvolvedor Python Junior', 'Brasil', 'week');
  assert.ok(url.includes('linkedin.com/jobs/search'), 'Should target linkedin jobs search');
  assert.ok(url.includes('keywords=Desenvolvedor%20Python%20Junior') || url.includes('keywords=Desenvolvedor+Python+Junior'), 'Should encode keywords');
  assert.ok(url.includes('location=Brasil'), 'Should specify location');
  assert.ok(url.includes('f_TPR='), 'Should specify time filter');
});

test('TDD: parseCardHtml should extract title, company, location and link from raw HTML card', () => {
  const sampleCardHtml = `
    <div class="base-card job-search-card">
      <a class="base-card__full-link" href="https://br.linkedin.com/jobs/view/desenvolvedor-python-123456?position=1">
        <h3 class="base-search-card__title">Desenvolvedor Python Junior</h3>
      </a>
      <h4 class="base-search-card__subtitle">
        <a class="hidden-nested-link">Tech Solutions</a>
      </h4>
      <div class="base-search-card__metadata">
        <span class="job-search-card__location">Remoto - Brasil</span>
        <time class="job-search-card__listdate">Há 2 dias</time>
      </div>
    </div>
  `;

  const parsed = parseCardHtml(sampleCardHtml);
  assert.strictEqual(parsed.title, 'Desenvolvedor Python Junior');
  assert.strictEqual(parsed.company, 'Tech Solutions');
  assert.strictEqual(parsed.location, 'Remoto - Brasil');
  assert.ok(parsed.link.includes('123456'), 'Link should contain job id');
  assert.strictEqual(parsed.posted, 'Há 2 dias');
});

test('TDD: parseJobDetails should extract job description and application type', () => {
  const samplePageHtml = `
    <html>
      <body>
        <div class="show-more-less-html__markup">
          <p>Estamos contratando Desenvolvedor Python com foco em FastAPI e AWS.</p>
          <p>Requisitos: Python, SQL, Docker.</p>
        </div>
        <button class="sign-in-modal__outlet-btn">Candidatura simplificada</button>
      </body>
    </html>
  `;

  const details = parseJobDetails(samplePageHtml);
  assert.ok(details.description.includes('Estamos contratando Desenvolvedor Python'), 'Description should be extracted');
  assert.strictEqual(details.applyType, 'Candidatura Simplificada (Easy Apply)');
});
