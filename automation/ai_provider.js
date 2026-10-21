const { calculateMatch } = require('./match_engine');

/**
 * AI Provider Abstraction Layer
 * - Decouples resume matching and tailoring logic from any specific AI client
 * - Enables plug-and-play support for:
 *   1. LocalHeuristicProvider (Rule-based, 100% offline, zero-token cost)
 *   2. GeminiProvider (Google Gemini API)
 *   3. OpenAiCompatibleProvider (OpenAI, Groq, Ollama, DeepSeek)
 *   4. CliAgentAdapter (CLI Agent prompt orchestrator)
 */

class BaseAiProvider {
  async generateSearchQueries(candidateProfile) {
    throw new Error('Not implemented: generateSearchQueries must be implemented by subclass');
  }

  async matchJob(jobDescription, candidateProfile) {
    throw new Error('Not implemented: matchJob must be implemented by subclass');
  }

  async evaluateJobFit({ job, candidateProfile, toolMatch }) {
    throw new Error('Not implemented: evaluateJobFit must be implemented by subclass');
  }

  async tailorResume({ masterHtml, job, matchedSkills }) {
    throw new Error('Not implemented: tailorResume must be implemented by subclass');
  }
}

function cleanJobTitle(rawTitle) {
  if (!rawTitle) return 'Engenheiro de Software';
  return rawTitle
    .replace(/\|\s*REF#?\w+/gi, '')
    .replace(/REF#?\w+/gi, '')
    .replace(/\b(trabalho remoto|remote work|remoto|híbrido|hybrid|pcd|vaga afirmativa)\b/gi, '')
    .replace(/[-–—|]\s*$/g, '')
    .replace(/^\s*[-–—|]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

class LocalHeuristicProvider extends BaseAiProvider {
  async generateSearchQueries(candidateProfile = {}) {
    const skills = (candidateProfile.skills || []).map(s => s.toLowerCase());
    const queries = [];

    // Estratégia 1: Dados e Nuvem
    if (skills.some(s => ['aws', 'glue', 'pyspark', 'spark', 'etl', 'sql'].includes(s))) {
      queries.push('Engenheiro de Dados Junior');
      queries.push('Desenvolvedor Python AWS');
    }

    // Estratégia 2: Fullstack & Frontend Moderno
    if (skills.some(s => ['react', 'next.js', 'typescript', 'node.js', 'node'].includes(s))) {
      queries.push('Desenvolvedor Fullstack Node React');
      queries.push('Desenvolvedor Frontend React');
    }

    // Estratégia 3: Backend & APIs
    if (skills.some(s => ['python', 'django', 'fastapi'].includes(s))) {
      queries.push('Desenvolvedor Backend Python');
    }

    return queries.length > 0 ? Array.from(new Set(queries)) : [
      'Desenvolvedor Python Junior',
      'Engenheiro de Dados Junior',
      'Desenvolvedor Fullstack Node React'
    ];
  }

  async matchJob(jobDescription, candidateProfile) {
    return calculateMatch(jobDescription, candidateProfile);
  }

  async evaluateJobFit({ job, candidateProfile = {}, toolMatch = null }) {
    const helperMatch = toolMatch || calculateMatch(job.description || '', candidateProfile);
    const title = (job.title || '').toLowerCase();
    const desc = (job.description || '').toLowerCase();
    const matchedSkills = [...(helperMatch.matchedSkills || [])];
    const missingSkills = [...(helperMatch.missingSkills || [])];

    let score = helperMatch.score || 50;

    // Detecção de compatibilidade semântica
    const isSeniorLead = /\b(senior|sênior|sr\.?|lead|lider|tech lead|principal|diretor|head)\b/i.test(title);
    const isJuniorPleno = /\b(junior|júnior|jr\.?|pleno|pl\.?|estagiario|estágio|intern|associate)\b/i.test(title);
    const hasCoreTech = matchedSkills.some(s => ['python', 'aws', 'react', 'typescript', 'node.js', 'node', 'sql'].includes(s));

    // Ajuste de pontuação baseado no contexto do cargo
    if (isSeniorLead && !hasCoreTech) {
      score = Math.max(15, score - 20);
    } else if (isJuniorPleno && hasCoreTech) {
      score = Math.min(100, score + 5);
    }

    let aiReasoning = '';
    let shouldAdd = true;
    let queued = false;

    if (score < 40) {
      shouldAdd = false;
      queued = false;
      aiReasoning = `Incompatível: baixa aderência técnica aos pilares do candidato (gaps em ${missingSkills.slice(0, 3).join(', ') || 'tecnologias principais'}).`;
    } else if (score >= 85) {
      shouldAdd = true;
      queued = true;
      const skillsStr = matchedSkills.slice(0, 4).join(', ');
      aiReasoning = `Excelente sinergia técnica (${score}%)! Oportunidade valoriza competências dominadas (${skillsStr}) e permite destacar liderança ágil, CI/CD e aceleração com IA.`;
    } else {
      shouldAdd = true;
      queued = false;
      const matchedStr = matchedSkills.slice(0, 3).join(', ');
      const gapsStr = missingSkills.slice(0, 2).join(', ');
      aiReasoning = `Boa aderência técnica (${score}%). Alinhamento sólido em ${matchedStr || 'desenvolvimento'}${gapsStr ? `, com gap secundário em ${gapsStr}` : ''}.`;
    }

    return {
      score,
      aiReasoning,
      matchedSkills,
      missingSkills,
      shouldAdd,
      queued
    };
  }

  async tailorResume({ masterHtml, job, matchedSkills = [] }) {
    let html = masterHtml;
    const cleanTitle = cleanJobTitle(job.title || 'Engenheiro de Software');

    // 1. Injeta título limpo no cabeçalho e na tag <title>
    html = html.replace(
      /<div class="title">[\s\S]*?<\/div>/i,
      `<div class="title">${cleanTitle} | Engenheiro de Software</div>`
    );
    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>Lucas Valente - ${job.company || 'Candidatura'}</title>`
    );

    // 2. Análise do domínio da vaga para personalização de conteúdo
    const jobText = `${cleanTitle} ${job.description || ''} ${matchedSkills.join(' ')}`.toLowerCase();
    const isData = jobText.includes('pyspark') || jobText.includes('spark') || jobText.includes('dados') || jobText.includes('data') || jobText.includes('glue') || jobText.includes('etl');
    const isFullstack = jobText.includes('react') || jobText.includes('typescript') || jobText.includes('frontend') || jobText.includes('next') || jobText.includes('fullstack') || jobText.includes('full-stack');

    // 3. Reescrita do Resumo Profissional enfatizando hard skills da vaga + soft skills (equipe, liderança, async, IA)
    let tailoredSummary = '';
    if (isData) {
      tailoredSummary = `Engenheiro de Software com forte especialização em Engenharia de Dados e Nuvem (AWS). Especialista no desenho de pipelines automatizados (ETL/ELT com Glue e PySpark) e modelagem dimensional em escala. Histórico comprovado de <strong>liderança técnica de squad</strong>, condução de code reviews e trabalho em <strong>equipe ágil com comunicação assíncrona</strong>. Pioneiro no uso de <strong>desenvolvimento assistido por IA</strong> (Claude Code, GitHub Copilot, MCP) para acelerar entregas críticas em 3x mantendo governança, FinOps e qualidade técnica. Certificado AWS Cloud Practitioner.`;
    } else if (isFullstack) {
      tailoredSummary = `Engenheiro de Software Fullstack especialista no ecossistema <strong>JavaScript/TypeScript moderno (React, Next.js, Node.js)</strong> e arquitetura escalável em nuvem (AWS). Experiência na migração de monólitos para microsserviços reativos e interfaces acessíveis de alta performance. Histórico sólido de <strong>liderança técnica</strong> e colaboração em <strong>equipe ágil com comunicação assíncrona</strong> estruturada. Alia cultura de testes (TDD com Vitest/Pytest) ao <strong>desenvolvimento assistido por IA</strong> (Claude Code, Copilot) para acelerar ciclos de entrega em até 3x mantendo código limpo e sustentável.`;
    } else {
      tailoredSummary = `Engenheiro de Software com sólida proficiência em desenvolvimento backend (Python/Django/FastAPI, Node.js), arquiteturas em nuvem (AWS) e microsserviços escaláveis. Foco em otimização de consultas SQL, redução de latência e resiliência de APIs. Histórico comprovado de <strong>liderança técnica</strong> e trabalho em <strong>equipe multidisciplinar com comunicação assíncrona</strong>. Utiliza <strong>desenvolvimento assistido por IA</strong> (Claude Code, Copilot, MCP) para acelerar a entrega de valor técnico, aplicando práticas rigorosas de TDD, CI/CD e segurança. Certificado AWS Cloud Practitioner.`;
    }

    html = html.replace(
      /<div class="summary">[\s\S]*?<\/div>/i,
      `<div class="summary">${tailoredSummary}</div>`
    );

    // 4. Experiências Profissionais (2 experiências calibradas e reescritas com soft skills e métricas)
    const tailoredExperiencesHtml = `
            <div class="job">
                <div class="job-header">
                    <div class="job-title-company">V3L0Z (UNAMA - Grupo SER)</div>
                    <div class="job-date">Maio 2025 - Presente</div>
                </div>
                <div class="job-position">Engenheiro de Software & Fullstack Developer</div>
                <ul>
                    <li>Atuação em <strong>equipe ágil multidisciplinar</strong> de 9+ desenvolvedores com <strong>comunicação assíncrona</strong>, garantindo suporte crítico e sustentação de sistemas para <strong>5000+ usuários ativos em 59+ unidades</strong>.</li>
                    <li>Liderou a refatoração de arquitetura monolítica para <strong>Microsserviços escaláveis</strong>, desacoplando frontend reativo de APIs REST e gerando <strong>40% de ganho de performance</strong> no carregamento.</li>
                    <li>Implementou cultura DevOps e esteira de <strong>CI/CD</strong> com automação de testes, reduzindo falhas em produção em <strong>70%</strong> e otimizando custos operacionais em 40%.</li>
                    <li>Otimizou consultas SQL e validações relacionais, reduzindo a latência média das requisições em <strong>30%</strong>.</li>
                </ul>
            </div>

            <div class="job">
                <div class="job-header">
                    <div class="job-title-company">Compass UOL</div>
                    <div class="job-date">Maio 2025 - Out 2025</div>
                </div>
                <div class="job-position">Engenheiro de Dados AWS & Líder de Squad</div>
                <ul>
                    <li><strong>Liderança Técnica:</strong> Liderou squad ágil de 4 engenheiros, conduzindo code reviews diários e garantindo 100% de pontualidade nas entregas.</li>
                    <li><strong>Aceleração com Inteligência Artificial:</strong> Utilizou desenvolvimento assistido por IA (Claude Code, Copilot, MCP) para <strong>entregar soluções 3x mais rápido</strong> com qualidade assegurada.</li>
                    <li>Projetou pipelines de dados (ETL) com <strong>AWS Glue e PySpark</strong>, automatizando ingestão e reduzindo o tempo de processamento manual em ~15 horas semanais.</li>
                    <li>Aplicou práticas de FinOps e automações serverless com AWS Lambda, gerando economia estimada de <strong>20% nos custos de nuvem</strong>.</li>
                </ul>
            </div>
    `;

    // 5. Seleção e reescrita dos 2 Projetos mais relevantes para a vaga (garantindo 1 página A4)
    let selectedProjectsHtml = '';
    if (isData) {
      selectedProjectsHtml = `
            <div class="project">
                <div class="project-header">
                    <span class="project-title-company">Pipeline Analítico Serverless em Nuvem (AWS & PySpark)</span>
                    <span class="project-date">2025</span>
                </div>
                <div class="project-position">Engenheiro de Dados AWS</div>
                <ul>
                    <li>Estruturou arquitetura de Data Lake no Amazon S3 e processou mais de <strong>1,5 milhão de registros</strong> com AWS Glue e PySpark.</li>
                    <li>Construiu dashboards estratégicos no Amazon QuickSight consolidando KPIs para múltiplos stakeholders com visualizações em tempo real.</li>
                    <li>Entregou a solução completa em 1 semana (50% antes do prazo previsto) via práticas ágeis e automação com IA.</li>
                </ul>
            </div>

            <div class="project">
                <div class="project-header">
                    <span class="project-title-company">Fintech Credit Scoring System (1º Lugar Hackathon)</span>
                    <span class="project-date">2026</span>
                </div>
                <div class="project-position">Fullstack Engineer & Architect</div>
                <ul>
                    <li>🏆 Premiado com o <strong>1º lugar na Hackathon Universitária</strong> por arquitetura escalável e inovadora em Next.js e TypeScript.</li>
                    <li>Desenvolveu motor de decision de crédito multidimensional analisando 5 pilares com dashboard em tempo real via Supabase.</li>
                    <li>Liderança colaborativa em equipe multidisciplinar sob prazo enxuto com foco em usabilidade e performance.</li>
                </ul>
            </div>
      `;
    } else if (isFullstack) {
      selectedProjectsHtml = `
            <div class="project">
                <div class="project-header">
                    <span class="project-title-company">Fintech Credit Scoring System (1º Lugar Hackathon)</span>
                    <span class="project-date">2026</span>
                </div>
                <div class="project-position">Fullstack Engineer & Architect</div>
                <ul>
                    <li>🏆 Premiado com o <strong>1º lugar na Hackathon Universitária</strong> com arquitetura escalável utilizando <strong>Next.js, TypeScript e Supabase</strong>.</li>
                    <li>Implementou dashboard administrativo de alta performance com Supabase Realtime, Shadcn UI e segurança robusta via RLS.</li>
                    <li>Trabalho em equipe de alta velocidade e liderança técnica na modelagem de componentes reativos e acessíveis.</li>
                </ul>
            </div>

            <div class="project">
                <div class="project-header">
                    <span class="project-title-company">Certix – Gestão de Certificados (Foco em TDD)</span>
                    <span class="project-date">2026</span>
                </div>
                <div class="project-position">Fullstack Developer (TDD Specialist)</div>
                <ul>
                    <li>Desenvolveu plataforma administrativa com <strong>React, TypeScript e TailwindCSS</strong>, otimizando fluxos de trabalho e UX.</li>
                    <li>Estabeleceu cultura de <strong>TDD (Test-Driven Development)</strong> com Vitest e Pytest, garantindo zero regressões em deploys.</li>
                    <li>Projetou APIs RESTful escaláveis com Django REST Framework e Service Pattern para consumo desacoplado no frontend.</li>
                </ul>
            </div>
      `;
    } else {
      selectedProjectsHtml = `
            <div class="project">
                <div class="project-header">
                    <span class="project-title-company">Astros – Plataforma Escalável de Serviços</span>
                    <span class="project-date">2026</span>
                </div>
                <div class="project-position">Backend Engineer & Solution Architect</div>
                <ul>
                    <li>Projetou e implementou aplicação de ponta a ponta com <strong>FastAPI e React</strong> para networking acadêmico em tempo real.</li>
                    <li>Estruturou modelagem relacional complexa com <strong>SQLModel</strong>, relacionamentos Many-to-Many e autenticação OAuth2 com JWT.</li>
                    <li>Desenvolveu motor de regras de negócio assíncronas e arquitetura modular facilitando manutenção por equipes remotas.</li>
                </ul>
            </div>

            <div class="project">
                <div class="project-header">
                    <span class="project-title-company">Sistema de Automação Jurídica (V3L0Z)</span>
                    <span class="project-date">2025</span>
                </div>
                <div class="project-position">Backend Engineer</div>
                <ul>
                    <li>Desenvolveu API RESTful com <strong>Django REST Framework</strong> preparada para centralização e integração de dados de 30+ tribunais.</li>
                    <li>Arquitetura orientada a microsserviços projetada para escalar além de 1.000+ usuários simultâneos com cache distribuído.</li>
                    <li>Atuação com equipe remota utilizando comunicação assíncrona, padronização RESTful e versionamento seguro de endpoints.</li>
                </ul>
            </div>
      `;
    }

    // Substitui as seções no HTML mestre
    html = html.replace(
      /(<div class="section-title">Experiência Profissional<\/div>)[\s\S]*?(<div class="section-title">(?:Projetos & Portfólio Técnico|Principais Projetos)<\/div>)/i,
      `$1\n${tailoredExperiencesHtml}\n        </div>\n\n        <div class="section">\n$2`
    );

    html = html.replace(
      /(<div class="section-title">(?:Projetos & Portfólio Técnico|Principais Projetos)<\/div>)[\s\S]*?(<div class="section-title">(?:Formação Acadêmica|Formação))/i,
      `$1\n${selectedProjectsHtml}\n        </div>\n\n        <div class="section">\n$2`
    );

    // 6. Calibração CSS Estrita de 1 Página A4
    const singlePageCss = `
        @page {
            size: A4 portrait;
            margin: 0;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            line-height: 1.22;
            color: #000;
            background: #fff;
            font-size: 9.0pt;
        }

        .container {
            max-width: 210mm;
            margin: 0 auto;
            background: #fff;
            padding: 0.32in;
            min-height: 297mm;
            position: relative;
        }

        .header {
            text-align: center;
            margin-bottom: 6px;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
        }

        .header h1 {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 1px;
            letter-spacing: 0.5px;
        }

        .header .title {
            font-size: 9.5pt;
            margin-bottom: 2px;
            font-weight: normal;
        }

        .contact {
            font-size: 8.5pt;
            line-height: 1.2;
        }

        .section {
            margin-bottom: 4px;
        }

        .section-title {
            font-size: 9.5pt;
            font-weight: bold;
            margin-bottom: 2px;
            padding-bottom: 1px;
            border-bottom: 1px solid #000;
            text-transform: uppercase;
        }

        .summary {
            text-align: justify;
            line-height: 1.22;
        }

        .skills-grid {
            line-height: 1.25;
        }

        .skill-category {
            margin-bottom: 1px;
        }

        .job, .project {
            margin-bottom: 3px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .project-header, .job-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 1px;
        }

        .project-title-company, .job-title-company {
            font-weight: bold;
            font-size: 9.2pt;
        }

        .project-date, .job-date {
            font-style: italic;
            font-size: 8.5pt;
            color: #333;
        }

        .project-position, .job-position {
            font-style: italic;
            margin-bottom: 1px;
            font-size: 8.8pt;
        }

        .job ul, .project ul {
            margin-left: 14px;
            margin-top: 1px;
        }

        .job li, .project li {
            margin-bottom: 0.5px;
            line-height: 1.22;
        }

        .education-item {
            margin-bottom: 2px;
        }

        .education-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
        }

        .education-school {
            font-weight: bold;
            font-size: 9pt;
        }

        .education-date {
            font-style: italic;
            font-size: 8.5pt;
            color: #333;
        }

        .education-degree {
            font-size: 8.8pt;
        }

        @media print {
            body { background: #fff; }
            .container {
                padding: 0.32in;
                margin: 0;
                min-height: auto;
            }
        }
    `;

    if (!html.includes('@page {')) {
      html = html.replace('</style>', `${singlePageCss}\n</style>`);
    } else {
      html = html.replace(/<style>[\s\S]*?<\/style>/i, `<style>\n${singlePageCss}\n</style>`);
    }

    return html;
  }
}

class OpenAiCompatibleProvider extends BaseAiProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = options.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.fallback = new LocalHeuristicProvider();
  }

  async generateSearchQueries(candidateProfile) {
    if (!this.apiKey) return this.fallback.generateSearchQueries(candidateProfile);

    const prompt = `Analise as competências deste profissional e gere um array JSON com 3 a 5 termos de busca estratégicos para vagas de tecnologia no LinkedIn:
Skills: ${(candidateProfile.skills || []).join(', ')}
Título: ${candidateProfile.title || 'Engenheiro de Software'}

Retorne APENAS um JSON no formato:
{ "queries": ["query 1", "query 2", "query 3"] }`;

    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) return this.fallback.generateSearchQueries(candidateProfile);
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      return Array.isArray(parsed.queries) ? parsed.queries : this.fallback.generateSearchQueries(candidateProfile);
    } catch (e) {
      return this.fallback.generateSearchQueries(candidateProfile);
    }
  }

  async matchJob(jobDescription, candidateProfile) {
    if (!this.apiKey) return this.fallback.matchJob(jobDescription, candidateProfile);

    const prompt = `Analise a descrição desta vaga e compare com as skills do candidato:
Vaga: ${jobDescription}
Skills do Candidato: ${(candidateProfile.skills || []).join(', ')}

Retorne APENAS um JSON no formato:
{ "score": 0-100, "matchedSkills": ["skill1"], "missingSkills": ["skill2"] }`;

    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) return this.fallback.matchJob(jobDescription, candidateProfile);
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return this.fallback.matchJob(jobDescription, candidateProfile);
    }
  }

  async evaluateJobFit({ job, candidateProfile, toolMatch }) {
    if (!this.apiKey) return this.fallback.evaluateJobFit({ job, candidateProfile, toolMatch });

    const prompt = `Você é um recrutador técnico especialista avaliando uma vaga para o candidato:
Vaga: ${job.title} em ${job.company}
Descrição: ${job.description}
Sinal preliminar de ferramentas: score prévio ${toolMatch ? toolMatch.score : 'N/A'}, skills identificadas: ${(toolMatch ? (toolMatch.matchedSkills || []).join(', ') : 'N/A')}
Perfil Candidato: ${(candidateProfile.skills || []).join(', ')}

Avalie com profundidade semântica a aderência real da vaga para o candidato.
Retorne APENAS um JSON estrito:
{
  "score": 0-100,
  "aiReasoning": "1 a 3 frases explicando detalhadamente a sinergia técnica ou os gaps",
  "matchedSkills": ["skill1"],
  "missingSkills": ["skill2"],
  "shouldAdd": true,
  "queued": false
}`;

    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }]
        })
      });

      if (!res.ok) return this.fallback.evaluateJobFit({ job, candidateProfile, toolMatch });
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return this.fallback.evaluateJobFit({ job, candidateProfile, toolMatch });
    }
  }

  async tailorResume({ masterHtml, job, matchedSkills }) {
    if (!this.apiKey) return this.fallback.tailorResume({ masterHtml, job, matchedSkills });
    // Em caso de API indisponível, faz fallback elegante para o motor local
    return this.fallback.tailorResume({ masterHtml, job, matchedSkills });
  }
}

class GeminiProvider extends BaseAiProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || 'gemini-1.5-flash';
    this.fallback = new LocalHeuristicProvider();
  }

  async generateSearchQueries(candidateProfile) {
    if (!this.apiKey) return this.fallback.generateSearchQueries(candidateProfile);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const prompt = `Analise as competências deste profissional e gere um array JSON com 3 a 5 termos de busca estratégicos para vagas de tecnologia no LinkedIn:
Skills: ${(candidateProfile.skills || []).join(', ')}
Título: ${candidateProfile.title || 'Engenheiro de Software'}

JSON estrito:
{ "queries": ["query 1", "query 2", "query 3"] }`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) return this.fallback.generateSearchQueries(candidateProfile);
      const data = await res.json();
      const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
      return Array.isArray(parsed.queries) ? parsed.queries : this.fallback.generateSearchQueries(candidateProfile);
    } catch (e) {
      return this.fallback.generateSearchQueries(candidateProfile);
    }
  }

  async matchJob(jobDescription, candidateProfile) {
    if (!this.apiKey) return this.fallback.matchJob(jobDescription, candidateProfile);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const prompt = `Analise a compatibilidade desta vaga e retorne JSON estrito:
Vaga: ${jobDescription}
Skills Candidato: ${(candidateProfile.skills || []).join(', ')}
JSON: { "score": number, "matchedSkills": string[], "missingSkills": string[] }`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) return this.fallback.matchJob(jobDescription, candidateProfile);
      const data = await res.json();
      const text = data.candidates[0].content.parts[0].text;
      return JSON.parse(text);
    } catch (e) {
      return this.fallback.matchJob(jobDescription, candidateProfile);
    }
  }

  async evaluateJobFit({ job, candidateProfile, toolMatch }) {
    if (!this.apiKey) return this.fallback.evaluateJobFit({ job, candidateProfile, toolMatch });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const prompt = `Você é um avaliador técnico especialista analisando a sinergia de uma vaga com o candidato:
Vaga: ${job.title} em ${job.company}
Descrição: ${job.description}
Sinal auxiliar: score ${toolMatch ? toolMatch.score : 'N/A'}, skills: ${(toolMatch ? (toolMatch.matchedSkills || []).join(', ') : 'N/A')}
Skills do Candidato: ${(candidateProfile.skills || []).join(', ')}

Retorne um JSON estrito com o veredito semântico:
{
  "score": number,
  "aiReasoning": string,
  "matchedSkills": string[],
  "missingSkills": string[],
  "shouldAdd": boolean,
  "queued": boolean
}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) return this.fallback.evaluateJobFit({ job, candidateProfile, toolMatch });
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) {
      return this.fallback.evaluateJobFit({ job, candidateProfile, toolMatch });
    }
  }

  async tailorResume({ masterHtml, job, matchedSkills }) {
    return this.fallback.tailorResume({ masterHtml, job, matchedSkills });
  }
}

function getAiProvider(name = process.env.AI_PROVIDER || 'local', options = {}) {
  const normalized = (name || '').toLowerCase();
  switch (normalized) {
    case 'openai':
    case 'groq':
    case 'ollama':
      return new OpenAiCompatibleProvider(options);
    case 'gemini':
      return new GeminiProvider(options);
    case 'local':
    default:
      return new LocalHeuristicProvider();
  }
}

module.exports = {
  BaseAiProvider,
  LocalHeuristicProvider,
  OpenAiCompatibleProvider,
  GeminiProvider,
  getAiProvider,
  cleanJobTitle
};
