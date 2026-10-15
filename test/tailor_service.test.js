const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { JobStore } = require('../automation/job_store');
const { LocalHeuristicProvider } = require('../automation/ai_provider');
const { tailorJobResume } = require('../automation/tailor_service');

const TEST_DB = path.resolve(__dirname, 'temp_tailor_jobs.json');
const TEST_ARCHIVES = path.resolve(__dirname, 'temp_archives');

test.beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  if (fs.existsSync(TEST_ARCHIVES)) fs.rmSync(TEST_ARCHIVES, { recursive: true, force: true });
});

test.afterEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  if (fs.existsSync(TEST_ARCHIVES)) fs.rmSync(TEST_ARCHIVES, { recursive: true, force: true });
});

test('TDD TailorService: should coordinate AI provider, file creation and status updates', async () => {
  const store = new JobStore(TEST_DB);
  const job = store.upsertJob({
    title: 'Desenvolvedor Python Jr',
    company: 'Empresa Alpha Service',
    link: 'https://linkedin.com/jobs/view/999',
    score: 92
  });

  const provider = new LocalHeuristicProvider();
  const masterPath = path.resolve(__dirname, '../src/master/v3/master_resume.html');

  const result = await tailorJobResume({
    jobId: job.id,
    store,
    aiProvider: provider,
    masterPath,
    archivesDir: TEST_ARCHIVES
  });

  assert.strictEqual(result.success, true);
  assert.ok(fs.existsSync(result.htmlPath), 'HTML file must exist');
  assert.ok(fs.existsSync(result.pdfPath), 'PDF file must exist');

  const updatedJob = store.getJobById(job.id);
  assert.strictEqual(updatedJob.status, 'Currículo Gerado');
  assert.strictEqual(updatedJob.queued, false);
});
