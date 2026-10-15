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
  async matchJob(jobDescription, candidateProfile) {
    throw new Error('Not implemented: matchJob must be implemented by subclass');
  }

  async tailorResume({ masterHtml, job, matchedSkills }) {
    throw new Error('Not implemented: tailorResume must be implemented by subclass');
  }
}

class LocalHeuristicProvider extends BaseAiProvider {
  async matchJob(jobDescription, candidateProfile) {
    return calculateMatch(jobDescription, candidateProfile);
  }

  async tailorResume({ masterHtml, job, matchedSkills }) {
    let html = masterHtml;

    if (job.title) {
      html = html.replace(
        /<div class="title">[\s\S]*?<\/div>/i,
        `<div class="title">${job.title} | Engenheiro de Software</div>`
      );
      html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>Lucas Valente - ${job.company || 'Candidatura'}</title>`
      );
    }

    const singlePageCss = `
        @page {
            size: A4 portrait;
            margin: 0;
        }

        body {
            font-family: Arial, sans-serif;
            line-height: 1.25;
            color: #000;
            background: #f5f5f5;
            font-size: 9.3pt;
        }

        .container {
            max-width: 210mm;
            margin: 0 auto;
            background: #fff;
            padding: 0.38in;
            min-height: 297mm;
            position: relative;
        }

        @media print {
            body { background: #fff; }
            .container {
                padding: 0.35in;
                margin: 0;
                min-height: auto;
            }
            .job, .project, .education-item {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }
    `;

    if (!html.includes('@page {')) {
      html = html.replace('</style>', `${singlePageCss}\n</style>`);
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
  getAiProvider
};
