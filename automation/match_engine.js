/**
 * Match Engine
 * - Extracts candidate skills and experiences from master resume HTML
 * - Analyzes job descriptions for required/preferred skills
 * - Computes match percentage (0-100%) and gap analysis
 * - Detects application type (Easy Apply vs External ATS)
 */

const KNOWN_TECH_KEYWORDS = [
  'python', 'django', 'fastapi', 'flask', 'pydantic',
  'node.js', 'node', 'express', 'fastify', 'typescript', 'javascript',
  'react', 'react native', 'next.js', 'tailwind', 'tailwindcss', 'shadcn',
  'sql', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis', 'bullmq',
  'drizzle', 'sqlalchemy',
  'gemini', 'claude', 'whisper', 'codex',
  'aws', 's3', 'lambda', 'glue', 'athena', 'quicksight', 'ec2', 'cloudwatch',
  'pyspark', 'spark', 'pandas', 'etl', 'elt',
  'docker', 'kubernetes', 'terraform', 'ci/cd', 'github actions', 'linux',
  'git', 'jira', 'scrum', 'kanban', 'tdd', 'pytest', 'vitest',
  'golang', 'java', 'c#', '.net', 'graphql', 'rest', 'restful'
];

function normalizeText(text) {
  return (text || '').toLowerCase().replace(/[\r\n]+/g, ' ');
}

function extractProfile(htmlContent) {
  const plainText = (htmlContent || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();

  const foundSkills = new Set();

  for (const tech of KNOWN_TECH_KEYWORDS) {
    // Regex com word boundary, tratando caracteres especiais como +, #, .
    const escaped = tech.replace(/([.+*?=^!:${}()|[\]/\\])/g, '\\$1');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (regex.test(plainText)) {
      foundSkills.add(tech);
    }
  }

  // Extrai título se presente
  const titleMatch = htmlContent.match(/class="title">([^<]+)<\/div>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  return {
    skills: Array.from(foundSkills),
    title
  };
}

function calculateMatch(jobDescription, profile) {
  const jobNorm = normalizeText(jobDescription);
  const candidateSkills = new Set((profile.skills || []).map(s => s.toLowerCase()));

  // Identifica quais tecnologias conhecidas aparecem na vaga
  const jobSkills = new Set();
  for (const tech of KNOWN_TECH_KEYWORDS) {
    const escaped = tech.replace(/([.+*?=^!:${}()|[\]/\\])/g, '\\$1');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (regex.test(jobNorm)) {
      jobSkills.add(tech);
    }
  }

  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of jobSkills) {
    if (candidateSkills.has(skill)) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  // Cálculo de pontuação:
  // Se a vaga não mencionou nenhuma tech reconhecida, default moderado baseado em termos gerais
  let score = 50;
  if (jobSkills.size > 0) {
    const matchRatio = matchedSkills.length / jobSkills.size;
    // Bônus se tecnologias centrais (Python, AWS, Node, SQL) forem encontradas
    const coreBonus = matchedSkills.some(s => ['python', 'aws', 'sql', 'node', 'node.js', 'react'].includes(s)) ? 10 : 0;
    
    // Penalidade por gaps
    const gapPenalty = missingSkills.length * 5;
    
    score = Math.round((matchRatio * 90) + coreBonus - gapPenalty);
    score = Math.max(10, Math.min(100, score));
  }

  return {
    score,
    totalJobSkills: jobSkills.size,
    matchedSkills,
    missingSkills,
    isTopMatch: score >= 90
  };
}

function detectApplicationType(htmlOrText) {
  const content = normalizeText(htmlOrText);
  if (content.includes('candidatura simplificada') || content.includes('easy apply') || content.includes('data-is-easy-apply="true"')) {
    return 'Candidatura Simplificada (Easy Apply)';
  }
  if (content.includes('gupy') || content.includes('greenhouse') || content.includes('lever') || content.includes('site da empresa') || content.includes('external')) {
    return 'Site Externo (Gupy / ATS)';
  }
  return 'Site Externo / Padrão';
}

module.exports = {
  extractProfile,
  calculateMatch,
  detectApplicationType,
  KNOWN_TECH_KEYWORDS
};
