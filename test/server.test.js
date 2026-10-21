const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { JobStore } = require('../automation/job_store');
const { createServer } = require('../automation/server');

const TEST_DB = path.resolve(__dirname, 'temp_server_jobs.json');

test.beforeEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test.afterEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

function request(server, path, method = 'GET', body = null) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {}
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data, headers: res.headers });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('TDD Server: GET /api/jobs should return all jobs', async () => {
  const store = new JobStore(TEST_DB);
  store.upsertJob({ title: 'Dev Python', company: 'Corp A', score: 85, link: 'http://a' });
  const server = createServer({ store });

  await new Promise(resolve => server.listen(0, resolve));

  try {
    const res = await request(server, '/api/jobs');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].title, 'Dev Python');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('TDD Server: POST /api/jobs/queue should toggle job queued status', async () => {
  const store = new JobStore(TEST_DB);
  const job = store.upsertJob({ title: 'Dev Node', company: 'Corp B', score: 75, link: 'http://b' });
  const server = createServer({ store });

  await new Promise(resolve => server.listen(0, resolve));

  try {
    const res = await request(server, '/api/jobs/queue', 'POST', { id: job.id, queued: true });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.queued, true);
    assert.strictEqual(res.data.status, 'Na Fila (Manual)');

    // Verify persisted
    const updated = store.getJobById(job.id);
    assert.strictEqual(updated.queued, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('TDD Server: GET /preview/:id should serve resume HTML if generated', async () => {
  const store = new JobStore(TEST_DB);
  const tempHtmlPath = path.resolve(__dirname, 'temp_sample_resume.html');
  fs.writeFileSync(tempHtmlPath, '<h1>Resume Preview Test</h1>', 'utf-8');

  try {
    const job = store.upsertJob({ title: 'Dev Fullstack', company: 'Corp C', score: 95, link: 'http://c' });
    store.markJobCompleted(job.id, { htmlPath: tempHtmlPath, pdfPath: '' });

    const server = createServer({ store });
    await new Promise(resolve => server.listen(0, resolve));

    try {
      const res = await request(server, `/preview/${job.id}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.raw.includes('Resume Preview Test'));
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
  }
});

test('TDD Server: GET /api/events should establish SSE stream and broadcast on changes', async () => {
  const store = new JobStore(TEST_DB);
  const server = createServer({ store });
  await new Promise(resolve => server.listen(0, resolve));

  const port = server.address().port;
  let receivedData = '';

  const clientReq = http.request({
    hostname: '127.0.0.1',
    port,
    path: '/api/events',
    method: 'GET'
  }, (res) => {
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/event-stream');
    res.on('data', chunk => {
      receivedData += chunk.toString();
    });
  });

  clientReq.end();

  // Aguarda evento inicial
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.ok(receivedData.includes('"type":"connected"'), 'Should receive initial connected event');

  // Dispara broadcast manual
  server.broadcastUpdate({ type: 'jobs_updated' });
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.ok(receivedData.includes('"type":"jobs_updated"'), 'Should receive broadcasted update event');

  clientReq.destroy();
  await new Promise(resolve => server.close(resolve));
});

