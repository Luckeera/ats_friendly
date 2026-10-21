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

test('TDD AiProvider: cleanJobTitle should remove REF codes and remote tags', () => {
  const { cleanJobTitle } = require('../automation/ai_provider');
  const dirty = "Senior Full-Stack Engineer (React, Node.js, TypeScript) - Remote Work | REF#303675";
  const cleaned = cleanJobTitle(dirty);
  assert.strictEqual(cleaned, "Senior Full-Stack Engineer (React, Node.js, TypeScript)");
  assert.ok(!cleaned.includes('REF#'));
  assert.ok(!cleaned.includes('Remote Work'));

  const dirty2 = "Desenvolvedor Python Junior - Trabalho Remoto";
  assert.strictEqual(cleanJobTitle(dirty2), "Desenvolvedor Python Junior");
});

test('TDD AiProvider: tailorResume should filter projects to max 2 and rewrite summary with soft skills and AI', async () => {
  const fs = require('fs');
  const path = require('path');
  const provider = new LocalHeuristicProvider();
  const masterHtml = fs.readFileSync(path.resolve(__dirname, '../src/master/v3/master_resume.html'), 'utf-8');

  const job = {
    title: 'Senior Full-Stack Engineer (React, Node.js, TypeScript) - Remote Work | REF#303675',
    company: 'BairesDev',
    description: 'Vaga para Fullstack com React, Node, TypeScript e AWS. Trabalho em equipe ágil e liderança.'
  };

  const tailored = await provider.tailorResume({
    masterHtml,
    job,
    matchedSkills: ['react', 'node', 'typescript', 'aws']
  });

  // Verify title is sanitized
  assert.ok(!tailored.includes('REF#303675'), 'Tailored HTML must not contain internal job reference code');
  assert.ok(tailored.includes('Senior Full-Stack Engineer (React, Node.js, TypeScript)'), 'Tailored HTML should contain clean title');

  // Verify soft skills and AI are emphasized in summary/experiences
  assert.ok(tailored.includes('equipe') || tailored.includes('squad'), 'Should emphasize teamwork');
  assert.ok(tailored.includes('IA') || tailored.includes('Claude') || tailored.includes('Copilot'), 'Should emphasize AI-assisted workflows');

  // Verify project filtering (master has 6 projects, tailored must have at most 2)
  const projectMatches = tailored.match(/class="project"/g) || [];
  assert.ok(projectMatches.length <= 2, `Should filter to at most 2 projects for 1-page A4, found ${projectMatches.length}`);
});

test('TDD AiProvider: generateSearchQueries should generate strategic queries from candidate profile', async () => {
  const provider = new LocalHeuristicProvider();
  const profile = {
    skills: ['python', 'aws', 'pyspark', 'react', 'typescript', 'node.js', 'django'],
    title: 'Engenheiro de Software'
  };

  const queries = await provider.generateSearchQueries(profile);
  assert.ok(Array.isArray(queries), 'Should return an array of queries');
  assert.ok(queries.length >= 2, 'Should generate at least 2 targeted search queries');
  assert.ok(queries.some(q => q.toLowerCase().includes('python') || q.toLowerCase().includes('dados') || q.toLowerCase().includes('react')), 'Queries must reflect candidate core skills');
});

test('TDD AiProvider: evaluateJobFit should read job, provide reasoning, and decide whether to add/queue', async () => {
  const provider = new LocalHeuristicProvider();
  const profile = {
    skills: ['python', 'django', 'fastapi', 'postgresql', 'aws', 'react', 'typescript'],
    title: 'Engenheiro de Software'
  };

  const highMatchJob = {
    title: 'Desenvolvedor Fullstack Python React',
    company: 'Tech Inovação',
    description: 'Buscamos Desenvolvedor Fullstack com Python (Django/FastAPI), React e banco relacional PostgreSQL. Experiência com AWS e trabalho em equipe ágil.'
  };

  const toolMatch = { score: 90, matchedSkills: ['python', 'django', 'react', 'postgresql', 'aws'], missingSkills: [] };
  const decision = await provider.evaluateJobFit({ job: highMatchJob, candidateProfile: profile, toolMatch });

  assert.ok(decision.score >= 80, `Expected score >= 80, got ${decision.score}`);
  assert.strictEqual(typeof decision.aiReasoning, 'string', 'Should return AI reasoning text');
  assert.ok(decision.aiReasoning.length > 20, 'Reasoning should be descriptive');
  assert.strictEqual(decision.shouldAdd, true, 'High match job should be added');
  assert.strictEqual(decision.queued, true, 'High match job (>=85%) should be auto-queued');

  // Test irrelevant / incompatible job
  const mismatchedJob = {
    title: 'Arquiteto Principal Rust / Firmware Embedded',
    company: 'Hardware Corp',
    description: 'Necessário 10 anos de C++, Assembly e desenvolvimento de kernels de baixo nível para microcontroladores ARM.'
  };
  const mismatchToolMatch = { score: 10, matchedSkills: [], missingSkills: ['rust', 'c++', 'assembly'] };
  const mismatchDecision = await provider.evaluateJobFit({ job: mismatchedJob, candidateProfile: profile, toolMatch: mismatchToolMatch });

  assert.ok(mismatchDecision.score < 50, 'Mismatched job should have low score');
  assert.strictEqual(mismatchDecision.queued, false, 'Mismatched job should not be queued');
  assert.ok(mismatchDecision.aiReasoning.toLowerCase().includes('incompatível') || mismatchDecision.aiReasoning.toLowerCase().includes('baixa') || mismatchDecision.aiReasoning.toLowerCase().includes('gap'), 'Reasoning should mention incompatibility or gap');
});

