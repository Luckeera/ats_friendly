const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JobStore } = require('../automation/job_store');
const { processQueue } = require('../automation/queue_processor');

const TEST_DB = path.resolve(__dirname, 'temp_process_queue.json');

test.beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test.afterEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('TDD QueueProcessor: processQueue should handle queued jobs', async () => {
  const store = new JobStore(TEST_DB);
  // Job without queue: shouldn't process
  store.upsertJob({
    title: 'Vue Dev',
    company: 'Ignored Co',
    score: 60,
    link: 'http://ignore'
  });

  const results = await processQueue({ store });
  assert.strictEqual(results.length, 0, 'Should not process jobs not in queue');
});
