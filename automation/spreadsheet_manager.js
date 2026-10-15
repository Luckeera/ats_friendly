const fs = require('fs');
const path = require('path');

/**
 * Spreadsheet Manager
 * - Reads, writes, deduplicates and sorts job opportunities in CSV format
 * - Handles proper CSV escaping and preserves status across hunts
 */

const HEADERS = [
  'score',
  'company',
  'title',
  'applyType',
  'location',
  'matchedSkills',
  'missingSkills',
  'status',
  'pdfPath',
  'link',
  'dateAdded'
];

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  if (Array.isArray(val)) {
    val = val.join(', ');
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // pula aspas escapadas
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function readJobsFromCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);
  const jobs = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const job = {};
    headers.forEach((h, idx) => {
      job[h] = values[idx] || '';
    });
    // Converte arrays
    if (job.matchedSkills && typeof job.matchedSkills === 'string') {
      job.matchedSkills = job.matchedSkills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (job.missingSkills && typeof job.missingSkills === 'string') {
      job.missingSkills = job.missingSkills.split(',').map(s => s.trim()).filter(Boolean);
    }
    jobs.push(job);
  }

  return jobs;
}

function saveJobsToCsv(newJobs, csvPath) {
  const existing = readJobsFromCsv(csvPath);
  const jobsByLink = new Map();

  // Carrega existentes
  for (const job of existing) {
    if (job.link) {
      jobsByLink.set(job.link, job);
    }
  }

  // Mescla novos (preservando status de 'Currículo Gerado' se já existia)
  const today = new Date().toISOString().split('T')[0];
  for (const job of newJobs) {
    if (!job.link) continue;

    if (jobsByLink.has(job.link)) {
      const current = jobsByLink.get(job.link);
      jobsByLink.set(job.link, {
        ...current,
        title: job.title || current.title,
        company: job.company || current.company,
        location: job.location || current.location,
        applyType: job.applyType || current.applyType,
        score: job.score !== undefined ? job.score : current.score,
        matchedSkills: job.matchedSkills || current.matchedSkills,
        missingSkills: job.missingSkills || current.missingSkills,
        status: (current.status && current.status !== 'Pendente') ? current.status : (job.status || 'Pendente'),
        pdfPath: current.pdfPath || job.pdfPath || ''
      });
    } else {
      jobsByLink.set(job.link, {
        ...job,
        status: job.status || 'Pendente',
        pdfPath: job.pdfPath || '',
        dateAdded: job.dateAdded || today
      });
    }
  }

  // Ordena por score decrescente
  const sortedJobs = Array.from(jobsByLink.values()).sort((a, b) => {
    return (parseInt(b.score, 10) || 0) - (parseInt(a.score, 10) || 0);
  });

  // Constrói CSV com BOM para compatibilidade com Excel no Windows
  const headerLine = HEADERS.join(',');
  const rowLines = sortedJobs.map(job => {
    return HEADERS.map(h => escapeCsvField(job[h])).join(',');
  });

  const outputContent = '\uFEFF' + [headerLine, ...rowLines].join('\n') + '\n';
  const dir = path.dirname(csvPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(csvPath, outputContent, 'utf-8');

  return sortedJobs;
}

function updateJobStatus(csvPath, jobLink, status, pdfPath = '') {
  const jobs = readJobsFromCsv(csvPath);
  let updated = false;

  for (const job of jobs) {
    if (job.link === jobLink) {
      job.status = status;
      if (pdfPath) job.pdfPath = pdfPath;
      updated = true;
      break;
    }
  }

  if (updated) {
    saveJobsToCsv(jobs, csvPath);
  }

  return updated;
}

module.exports = {
  saveJobsToCsv,
  readJobsFromCsv,
  updateJobStatus,
  HEADERS
};
