const test = require('node:test');
const assert = require('node:assert');
const {
  BaseAiProvider,
  LocalHeuristicProvider,
  OpenAiCompatibleProvider,
  getAiProvider
} = require('../automation/ai_provider');

test('TDD AiProvider: BaseAiProvider should define standard interface', () => {
  const provider = new BaseAiProvider();
  assert.rejects(async () => await provider.matchJob('desc', {}), /Not implemented/);
  assert.rejects(async () => await provider.tailorResume({}), /Not implemented/);
});

test('TDD AiProvider: LocalHeuristicProvider should match job and tailor resume offline', async () => {
  const provider = new LocalHeuristicProvider();

  const profile = {
    skills: ['python', 'django', 'postgresql', 'aws'],
    title: 'Engenheiro de Software'
  };

  const job = {
    title: 'Desenvolvedor Python Jr',
    company: 'Empresa Teste',
    description: 'Buscamos Desenvolvedor Python com experiência em Django e banco PostgreSQL.'
  };

  const match = await provider.matchJob(job.description, profile);
  assert.ok(match.score >= 80, `Score should be >= 80, got ${match.score}`);
  assert.ok(match.matchedSkills.includes('python'));
  assert.ok(match.matchedSkills.includes('django'));

  const sampleMaster = `
    <html>
      <head><style></style></head>
      <body>
        <div class="title">Engenheiro</div>
      </body>
    </html>
  `;

  const tailored = await provider.tailorResume({ masterHtml: sampleMaster, job, matchedSkills: match.matchedSkills });
  assert.ok(tailored.includes('Desenvolvedor Python Jr'), 'Should inject job title');
  assert.ok(tailored.includes('@page {'), 'Should ensure 1-page A4 CSS rules');
});

test('TDD AiProvider: getAiProvider factory should return configured provider', () => {
  const defaultProv = getAiProvider('local');
  assert.ok(defaultProv instanceof LocalHeuristicProvider);

  const customProv = getAiProvider('openai', { apiKey: 'fake-key', baseURL: 'https://api.openai.com/v1' });
  assert.ok(customProv instanceof OpenAiCompatibleProvider);
});
