const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JobStore } = require('../automation/job_store');

const TEST_DB_PATH = path.resolve(__dirname, 'temp_test_jobs.json');

test.beforeEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

test.afterEach(() => {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

test('TDD JobStore: should save and retrieve jobs with unique IDs', () => {
  const store = new JobStore(TEST_DB_PATH);
  const job = {
    title: 'Desenvolvedor Python Jr',
    company: 'Empresa A',
    location: 'Remoto',
    link: 'https://linkedin.com/jobs/view/100',
    score: 95,
    applyType: 'Candidatura Simplificada (Easy Apply)'
  };

  const saved = store.upsertJob(job);
  assert.ok(saved.id, 'Job should have a generated unique ID');
  assert.strictEqual(saved.company, 'Empresa A');

  const allJobs = store.getJobs();
  assert.strictEqual(allJobs.length, 1);
  assert.strictEqual(allJobs[0].id, saved.id);
});

test('TDD JobStore: should automatically queue jobs with score >= 90', () => {
  const store = new JobStore(TEST_DB_PATH);
  
  const highMatch = store.upsertJob({
    title: 'Engenheiro de Dados AWS',
    company: 'Tech Corp',
    link: 'https://linkedin.com/jobs/view/200',
    score: 92
  });

  const lowMatch = store.upsertJob({
    title: 'Dev Frontend Vue',
    company: 'Outra Corp',
    link: 'https://linkedin.com/jobs/view/201',
    score: 65
  });

  assert.strictEqual(highMatch.queued, true, 'Score >= 90 should be auto-queued');
  assert.strictEqual(highMatch.status, 'Na Fila (Match 90%+)');

  assert.strictEqual(lowMatch.queued, false, 'Score < 90 should not be auto-queued');
  assert.strictEqual(lowMatch.status, 'Pendente');
});

test('TDD JobStore: should toggle queue status manually for any job', () => {
  const store = new JobStore(TEST_DB_PATH);
  const job = store.upsertJob({
    title: 'Dev Python & Django',
    company: 'Startup X',
    link: 'https://linkedin.com/jobs/view/300',
    score: 82
  });

  assert.strictEqual(job.queued, false);

  // Ativa na fila
  const queued = store.setQueueStatus(job.id, true);
  assert.strictEqual(queued.queued, true);
  assert.strictEqual(queued.status, 'Na Fila (Manual)');

  // Busca vagas na fila
  const queuedList = store.getQueuedJobs();
  assert.strictEqual(queuedList.length, 1);
  assert.strictEqual(queuedList[0].id, job.id);

  // Remove da fila
  const dequeued = store.setQueueStatus(job.id, false);
  assert.strictEqual(dequeued.queued, false);
  assert.strictEqual(dequeued.status, 'Pendente');
});

test('TDD JobStore: should record generation progress and paths', () => {
  const store = new JobStore(TEST_DB_PATH);
  const job = store.upsertJob({
    title: 'Python Jr',
    company: 'Empresa Alpha',
    link: 'https://linkedin.com/jobs/view/400',
    score: 95
  });

  // Marca como gerando
  store.updateJobProgress(job.id, 'Gerando Currículo...');
  assert.strictEqual(store.getJobById(job.id).status, 'Gerando Currículo...');

  // Marca como concluído com caminhos
  store.markJobCompleted(job.id, {
    htmlPath: 'archives/EmpresaAlpha/resume.html',
    pdfPath: 'archives/EmpresaAlpha/resume.pdf'
  });

  const completed = store.getJobById(job.id);
  assert.strictEqual(completed.status, 'Currículo Gerado');
  assert.strictEqual(completed.queued, false);
  assert.strictEqual(completed.htmlPath, 'archives/EmpresaAlpha/resume.html');
  assert.strictEqual(completed.pdfPath, 'archives/EmpresaAlpha/resume.pdf');
});
