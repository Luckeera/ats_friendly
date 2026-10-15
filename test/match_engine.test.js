const test = require('node:test');
const assert = require('node:assert');
const { extractProfile, calculateMatch, detectApplicationType } = require('../automation/match_engine');

test('TDD: extractProfile should parse technical skills and keywords from master resume HTML', () => {
  const sampleHtml = `
    <div class="title">Engenheiro de Software & Dados | Cloud AWS & DevOps</div>
    <div class="skills-grid">
      <div class="skill-category"><strong>Cloud:</strong> AWS (Glue, Lambda, S3), Docker, Terraform.</div>
      <div class="skill-category"><strong>Backend:</strong> Python (Django, FastAPI), Node.js (Fastify, Express), PostgreSQL.</div>
    </div>
  `;

  const profile = extractProfile(sampleHtml);
  assert.ok(profile, 'Profile should be extracted');
  assert.ok(Array.isArray(profile.skills), 'Skills should be an array');
  assert.ok(profile.skills.includes('python'), 'Should extract python');
  assert.ok(profile.skills.includes('aws'), 'Should extract aws');
  assert.ok(profile.skills.includes('node.js') || profile.skills.includes('node'), 'Should extract node');
  assert.ok(profile.skills.includes('postgresql'), 'Should extract postgresql');
});

test('TDD: calculateMatch should return high score for strongly matching job', () => {
  const profile = {
    skills: ['python', 'django', 'fastapi', 'postgresql', 'aws', 'docker', 'git'],
    title: 'Engenheiro de Software'
  };

  const jobDescription = `
    Vaga: Desenvolvedor Backend Python Junior
    Requisitos:
    - Forte conhecimento em Python e frameworks Django ou FastAPI.
    - Experiência com banco de dados relacional PostgreSQL.
    - Conhecimento em Git e Docker.
    - Cloud AWS é um diferencial.
  `;

  const result = calculateMatch(jobDescription, profile);
  assert.ok(result.score >= 85, `Score should be >= 85, got ${result.score}`);
  assert.ok(result.matchedSkills.includes('python'), 'Matched skills should include python');
  assert.ok(result.matchedSkills.includes('django'), 'Matched skills should include django');
  assert.ok(result.matchedSkills.includes('postgresql'), 'Matched skills should include postgresql');
});

test('TDD: calculateMatch should detect missing skills (gaps)', () => {
  const profile = {
    skills: ['python', 'django', 'postgresql'],
    title: 'Desenvolvedor'
  };

  const jobDescription = `
    Vaga: Desenvolvedor Python & Golang
    Requisitos:
    - Python, Django
    - Experiência obrigatória com Golang e Kubernetes
  `;

  const result = calculateMatch(jobDescription, profile);
  assert.ok(result.missingSkills.includes('golang'), 'Should list golang as missing');
  assert.ok(result.missingSkills.includes('kubernetes'), 'Should list kubernetes as missing');
  assert.ok(result.score < 80, `Score should reflect gaps, got ${result.score}`);
});

test('TDD: detectApplicationType should identify Easy Apply vs External site', () => {
  const easyApplySample = '<div><button>Candidatura simplificada</button></div>';
  const externalSample = '<div><a href="https://empresa.gupy.io/job/123">Candidate-se no site da empresa</a></div>';

  assert.strictEqual(detectApplicationType(easyApplySample), 'Candidatura Simplificada (Easy Apply)');
  assert.strictEqual(detectApplicationType(externalSample), 'Site Externo (Gupy / ATS)');
});

test('TDD: extractProfile should parse real master_resume.html correctly', () => {
  const fs = require('fs');
  const path = require('path');
  const masterHtml = fs.readFileSync(path.resolve(__dirname, '../src/master/v3/master_resume.html'), 'utf-8');
  const profile = extractProfile(masterHtml);

  assert.ok(profile.skills.length >= 10, 'Should extract at least 10 key skills from master resume');
  assert.ok(profile.skills.includes('python'), 'Master profile must have python');
  assert.ok(profile.skills.includes('aws'), 'Master profile must have aws');
  assert.ok(profile.skills.includes('pyspark') || profile.skills.includes('spark'), 'Master profile must have spark');
  assert.ok(profile.skills.includes('fastapi') || profile.skills.includes('django'), 'Master profile must have python frameworks');
});

