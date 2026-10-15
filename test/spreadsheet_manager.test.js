const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { saveJobsToCsv, readJobsFromCsv, updateJobStatus } = require('../automation/spreadsheet_manager');

const TEST_CSV_PATH = path.resolve(__dirname, 'temp_test_vagas.csv');

test.beforeEach(() => {
  if (fs.existsSync(TEST_CSV_PATH)) {
    fs.unlinkSync(TEST_CSV_PATH);
  }
});

test.afterEach(() => {
  if (fs.existsSync(TEST_CSV_PATH)) {
    fs.unlinkSync(TEST_CSV_PATH);
  }
});

test('TDD: saveJobsToCsv should create a formatted CSV sorted by score descending', () => {
  const sampleJobs = [
    {
      title: 'Desenvolvedor Python Jr',
      company: 'Empresa A',
      location: 'Remoto',
      link: 'https://linkedin.com/jobs/view/100',
      applyType: 'Candidatura Simplificada (Easy Apply)',
      score: 85,
      matchedSkills: ['python', 'django'],
      missingSkills: ['docker'],
      status: 'Pendente'
    },
    {
      title: 'Engenheiro de Dados AWS',
      company: 'Empresa B',
      location: 'São Paulo',
      link: 'https://linkedin.com/jobs/view/200',
      applyType: 'Site Externo (Gupy / ATS)',
      score: 95,
      matchedSkills: ['aws', 'glue', 'pyspark', 'sql'],
      missingSkills: [],
      status: 'Pendente'
    }
  ];

  saveJobsToCsv(sampleJobs, TEST_CSV_PATH);

  assert.ok(fs.existsSync(TEST_CSV_PATH), 'CSV file should be created');
  const readBack = readJobsFromCsv(TEST_CSV_PATH);
  assert.strictEqual(readBack.length, 2, 'Should contain 2 jobs');
  // Order check: highest score first
  assert.strictEqual(readBack[0].company, 'Empresa B', 'Highest score job should be first');
  assert.strictEqual(parseInt(readBack[0].score, 10), 95);
  assert.strictEqual(readBack[1].company, 'Empresa A');
});

test('TDD: saveJobsToCsv should deduplicate jobs by link and preserve existing status', () => {
  const initialJobs = [
    {
      title: 'Desenvolvedor Python Jr',
      company: 'Empresa A',
      location: 'Remoto',
      link: 'https://linkedin.com/jobs/view/100',
      applyType: 'Candidatura Simplificada (Easy Apply)',
      score: 85,
      matchedSkills: ['python'],
      missingSkills: [],
      status: 'Currículo Gerado',
      pdfPath: 'archives/EmpresaA/resume.pdf'
    }
  ];

  saveJobsToCsv(initialJobs, TEST_CSV_PATH);

  // New fetch comes in with the same job link
  const incomingJobs = [
    {
      title: 'Desenvolvedor Python Jr (Updated)',
      company: 'Empresa A',
      location: 'Remoto',
      link: 'https://linkedin.com/jobs/view/100',
      applyType: 'Candidatura Simplificada (Easy Apply)',
      score: 90,
      matchedSkills: ['python', 'fastapi'],
      missingSkills: [],
      status: 'Pendente'
    }
  ];

  saveJobsToCsv(incomingJobs, TEST_CSV_PATH);

  const readBack = readJobsFromCsv(TEST_CSV_PATH);
  assert.strictEqual(readBack.length, 1, 'Should not duplicate job');
  assert.strictEqual(readBack[0].status, 'Currículo Gerado', 'Should preserve existing status if already generated');
  assert.strictEqual(readBack[0].pdfPath, 'archives/EmpresaA/resume.pdf', 'Should preserve pdf path');
});

test('TDD: updateJobStatus should update status and pdfPath of target job', () => {
  const jobs = [
    {
      title: 'Dev Python',
      company: 'Tech Co',
      location: 'Remoto',
      link: 'https://linkedin.com/jobs/view/300',
      applyType: 'Candidatura Simplificada (Easy Apply)',
      score: 92,
      matchedSkills: ['python'],
      missingSkills: [],
      status: 'Pendente'
    }
  ];

  saveJobsToCsv(jobs, TEST_CSV_PATH);
  updateJobStatus(TEST_CSV_PATH, 'https://linkedin.com/jobs/view/300', 'Currículo Gerado', 'archives/TechCo/resume.pdf');

  const readBack = readJobsFromCsv(TEST_CSV_PATH);
  assert.strictEqual(readBack[0].status, 'Currículo Gerado');
  assert.strictEqual(readBack[0].pdfPath, 'archives/TechCo/resume.pdf');
});
