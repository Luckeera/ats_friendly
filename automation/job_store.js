const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { saveJobsToCsv } = require('./spreadsheet_manager');

/**
 * JobStore
 * - Central persistence layer for job applications, matching scores, and resume generation queues
 * - Maintains JSON database and syncs with CSV spreadsheet
 */

class JobStore {
  constructor(dbPath = path.resolve(__dirname, '../data/vagas.json'), csvPath = path.resolve(__dirname, '../vagas.csv')) {
    this.dbPath = dbPath;
    this.csvPath = csvPath;
    this.jobs = [];
    this._load();
  }

  _load() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        this.jobs = JSON.parse(raw);
      } catch (e) {
        this.jobs = [];
      }
    } else {
      this.jobs = [];
    }
  }

  _save() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, JSON.stringify(this.jobs, null, 2), 'utf-8');

    // Sincroniza com CSV se houver caminho configurado
    if (this.csvPath) {
      try {
        saveJobsToCsv(this.jobs, this.csvPath);
      } catch (e) {
        // Ignora erros na sync do CSV em testes isolados
      }
    }
  }

  _generateId(job) {
    if (job.id) return job.id;
    const str = job.link || `${job.company}-${job.title}-${Date.now()}`;
    return crypto.createHash('md5').update(str).digest('hex').slice(0, 10);
  }

  getJobs() {
    return [...this.jobs].sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  getJobById(id) {
    return this.jobs.find(j => j.id === id);
  }

  upsertJob(jobData) {
    const id = this._generateId(jobData);
    const existingIndex = this.jobs.findIndex(j => j.id === id || (jobData.link && j.link === jobData.link));

    const isTopMatch = (parseInt(jobData.score, 10) || 0) >= 90;
    const today = new Date().toISOString().split('T')[0];

    let jobRecord;

    if (existingIndex >= 0) {
      const existing = this.jobs[existingIndex];
      jobRecord = {
        ...existing,
        ...jobData,
        id: existing.id,
        // Preserva se já estiver gerado
        status: existing.status === 'Currículo Gerado' ? 'Currículo Gerado' : (existing.status || (isTopMatch ? 'Na Fila (Match 90%+)' : 'Pendente')),
        queued: existing.status === 'Currículo Gerado' ? false : (existing.queued !== undefined ? existing.queued : isTopMatch),
        htmlPath: existing.htmlPath || jobData.htmlPath || '',
        pdfPath: existing.pdfPath || jobData.pdfPath || '',
        updatedAt: today
      };
      this.jobs[existingIndex] = jobRecord;
    } else {
      jobRecord = {
        ...jobData,
        id,
        status: isTopMatch ? 'Na Fila (Match 90%+)' : 'Pendente',
        queued: isTopMatch,
        htmlPath: jobData.htmlPath || '',
        pdfPath: jobData.pdfPath || '',
        dateAdded: today,
        updatedAt: today
      };
      this.jobs.push(jobRecord);
    }

    this._save();
    return jobRecord;
  }

  setQueueStatus(id, queued) {
    const job = this.getJobById(id);
    if (!job) return null;

    job.queued = Boolean(queued);
    if (job.status !== 'Currículo Gerado') {
      job.status = job.queued ? 'Na Fila (Manual)' : 'Pendente';
    }
    job.updatedAt = new Date().toISOString().split('T')[0];

    this._save();
    return job;
  }

  getQueuedJobs() {
    return this.jobs.filter(j => j.queued && j.status !== 'Currículo Gerado');
  }

  updateJobProgress(id, statusMessage) {
    const job = this.getJobById(id);
    if (!job) return null;

    job.status = statusMessage;
    job.updatedAt = new Date().toISOString().split('T')[0];
    this._save();
    return job;
  }

  markJobCompleted(id, { htmlPath, pdfPath }) {
    const job = this.getJobById(id);
    if (!job) return null;

    job.status = 'Currículo Gerado';
    job.queued = false;
    job.htmlPath = htmlPath;
    job.pdfPath = pdfPath;
    job.completedAt = new Date().toISOString().split('T')[0];

    this._save();
    return job;
  }
}

// Instância padrão para conveniência
const defaultStore = new JobStore();

module.exports = {
  JobStore,
  defaultStore
};
