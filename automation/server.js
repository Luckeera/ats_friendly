const http = require('http');
const fs = require('fs');
const path = require('path');
const { defaultStore } = require('./job_store');

/**
 * Local Web Server & API for Job Dashboard
 * - Serves interactive frontend
 * - Handles queue toggle, previews and job status updates
 */

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function createServer(options = {}) {
  const store = options.store || defaultStore;
  const publicDir = path.resolve(__dirname, 'public');
  const sseClients = new Set();

  function broadcastUpdate(payload = { type: 'jobs_updated' }) {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }

  // File watcher reativo no store para disparar SSE instantaneamente em caso de mutação
  let fileWatcher = null;
  let debounceTimer = null;
  if (store && store.filePath) {
    try {
      const watchPath = store.filePath;
      if (!fs.existsSync(watchPath)) {
        const dir = path.dirname(watchPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(watchPath, '[]', 'utf-8');
      }
      fileWatcher = fs.watch(watchPath, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          broadcastUpdate({ type: 'jobs_updated', timestamp: Date.now() });
        }, 120);
      });
    } catch (e) {
      // Ignora falha de watch em ambientes sem suporte
    }
  }

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    try {
      // 1. API: Listar vagas
      if (method === 'GET' && pathname === '/api/jobs') {
        const jobs = store.getJobs();
        return sendJson(res, 200, jobs);
      }

      // 1.5. API: Server-Sent Events (SSE) para atualização reativa instantânea
      if (method === 'GET' && pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
        sseClients.add(res);

        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      // 2. API: Listar vagas na fila
      if (method === 'GET' && pathname === '/api/jobs/queued') {
        const queued = store.getQueuedJobs();
        return sendJson(res, 200, queued);
      }

      // 3. API: Alternar fila (toggle queue)
      if (method === 'POST' && pathname === '/api/jobs/queue') {
        const body = await parseJsonBody(req);
        if (!body.id) {
          return sendJson(res, 400, { error: 'O campo id é obrigatório' });
        }
        const updated = store.setQueueStatus(body.id, body.queued);
        if (!updated) {
          return sendJson(res, 404, { error: 'Vaga não encontrada' });
        }
        return sendJson(res, 200, updated);
      }

      // 3.5. API: Disparar geração imediata para uma vaga via TailorService
      if (method === 'POST' && pathname === '/api/jobs/generate') {
        const body = await parseJsonBody(req);
        if (!body.id) {
          return sendJson(res, 400, { error: 'O campo id é obrigatório' });
        }
        const { tailorJobResume } = require('./tailor_service');
        try {
          const result = await tailorJobResume({ jobId: body.id, store });
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      }

      // 4. Preview HTML do currículo gerado
      if (method === 'GET' && pathname.startsWith('/preview/')) {
        const jobId = pathname.replace('/preview/', '');
        const job = store.getJobById(jobId);
        if (!job || !job.htmlPath || !fs.existsSync(job.htmlPath)) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end('<h3>Currículo HTML ainda não gerado ou arquivo não encontrado.</h3>');
        }
        const html = fs.readFileSync(job.htmlPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }

      // 5. Download / View PDF do currículo
      if (method === 'GET' && pathname.startsWith('/pdf/')) {
        const jobId = pathname.replace('/pdf/', '');
        const job = store.getJobById(jobId);
        if (!job || !job.pdfPath || !fs.existsSync(job.pdfPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('PDF ainda não gerado.');
        }
        const pdf = fs.readFileSync(job.pdfPath);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline'
        });
        return res.end(pdf);
      }

      // 6. Arquivos estáticos do Dashboard Frontend
      let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        return fs.createReadStream(filePath).pipe(res);
      }

      // Fallback para index.html
      const indexPath = path.join(publicDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(indexPath).pipe(res);
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Página não encontrada');
    } catch (err) {
      console.error('Erro no servidor:', err);
      sendJson(res, 500, { error: err.message });
    }
  });

  server.on('close', () => {
    if (fileWatcher) {
      try { fileWatcher.close(); } catch (e) {}
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    for (const client of sseClients) {
      try { client.end(); } catch (e) {}
    }
    sseClients.clear();
  });

  server.broadcastUpdate = broadcastUpdate;

  return server;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`\n🌐 Painel de Vagas & Currículos ativo em: http://localhost:${PORT}`);
    console.log(`Pressione Ctrl+C para encerrar o servidor.\n`);
  });
}

module.exports = {
  createServer
};
