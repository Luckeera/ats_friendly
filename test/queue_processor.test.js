const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JobStore } = require('../automation/job_store');
const { buildTailoredResumeHtml } = require('../automation/queue_processor');

test('TDD QueueProcessor: buildTailoredResumeHtml should customize master resume for target job', () => {
  const masterPath = path.resolve(__dirname, '../src/master/v3/master_resume.html');
  const masterHtml = fs.readFileSync(masterPath, 'utf-8');

  const targetJob = {
    title: 'Desenvolvedor Backend Python Jr',
    company: 'Empresa Teste',
    matchedSkills: ['python', 'django', 'fastapi', 'postgresql', 'docker'],
    missingSkills: []
  };

  const tailoredHtml = buildTailoredResumeHtml(masterHtml, targetJob);
  assert.ok(tailoredHtml.includes('Empresa Teste') || tailoredHtml.includes('Lucas Valente'), 'Should retain candidate details');
  assert.ok(tailoredHtml.includes('@page {'), 'Must include @page single-page printing constraint');
  assert.ok(tailoredHtml.toLowerCase().includes('python'), 'Must feature matched skills');
});

