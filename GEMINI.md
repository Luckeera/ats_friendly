# Gemini CLI Project Mandates - Resume-as-Code

## Core Constraints
- **One-Page Limit:** Every resume generated for a specific job application MUST fit on a single A4 page.
- **Experience Filtering:** Do not attempt to include the full `master_resume.html` content. Selectively filter and include only the professional experiences, projects, and skills that directly align with the target job description (via `./research/current/vaga.md` or the automated hunter).
- **ATS Optimization:** Maintain the single-column structure and standard semantic naming conventions defined in the master templates.

## Workflow Integration
- **Master Sync (Feature A):** Ensure `master_resume.html` remains the comprehensive source of truth, even if it exceeds one page. The one-page limit strictly applies to individual job applications in `/archives`.
- **PDF Compilation & Validation:** When generating a PDF, always verify that the visual output remains professional, clean, and strictly conforms to the single A4 page boundary.
- **Test-Driven Development (TDD):** Any new features or changes to matching algorithms, scraping parsers, store management, or adapters must be backed by unit tests in `./test`.

## Automation & Hunter Architecture
- **Safe Guest-Mode Scraping:** Public LinkedIn scraping must run strictly in unauthenticated guest mode to eliminate account suspension risks.
- **On-Demand CLI Agent Execution:** The architecture operates purely on-demand when invoked by the user in the CLI. Avoid 24/7 background daemons or external message brokers (e.g., RabbitMQ, Redis, BullMQ).
- **Lightweight Queue Semantics:** The "fila" is managed as an explicit boolean flag (`queued: true/false`) in `data/vagas.json`. The web dashboard at `http://localhost:3000` enables visual curation and queue marking, while the CLI agent processes marked jobs when triggered by chat.
- **Pluggable AI Adapter Layer:** The tailor and matching engines must remain decoupled from specific AI backends via `automation/ai_provider.js` (supporting Local Heuristic, Gemini API, and OpenAI-compatible endpoints) to allow future SaaS migration for non-technical users.

## Future Integrations - Email Tracking Security & Privacy Mandate
- **Strict Whitelist on Applied Jobs Only:** When implementing email inbox reading/tracking for application status updates, the agent/system MUST ONLY query and read emails whose senders, domains, or subjects strictly correspond to companies and positions recorded as applied in `data/vagas.json` / `vagas.csv`.
- **Zero Irrelevant Email Access:** Never read, scan, parse, or log emails unrelated to recorded applications. For example, if the user applied exclusively to Samsung, the agent is strictly prohibited from inspecting emails from Google, financial institutions, newsletters, personal contacts, or any other unauthorized sender.
- **No Automated Outbound Mails:** Automated application submission or message sending must never occur without explicit user confirmation.
