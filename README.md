# Resume-as-Code & ATS Optimization Framework

Este repositório contém um sistema de gerenciamento de currículos focado em **automação**, **versionamento**, **inteligência de mercado** e **otimização para ATS** (Applicant Tracking Systems). 

Em vez de editar arquivos estáticos, este projeto utiliza uma abordagem baseada em código e templates HTML/CSS para gerar currículos profissionais em PDF, garantindo que cada candidatura seja personalizada, estritamente restrita a **uma página A4** e tecnicamente otimizada para os robôs de triagem.

---

## 🚀 Funcionalidades

- **Templates Semânticos:** Currículos estruturados em HTML5 puro, otimizados para leitura por parsers de IA e sistemas de recrutamento.
- **Automação de PDF (1 Página A4):** Geração de PDFs via Headless Browser (Edge/Puppeteer), com corte milimétrico e auditoria automatizada de páginas.
- **LinkedIn Hunter Seguro (Modo Guest / On-Demand):** Varredura pública sem credenciais ou login, eliminando qualquer risco de banimento de conta.
- **Motor de Match & Gap Analysis:** Cálculo semântico de aderência técnica (0-100%) entre a descrição da vaga e as competências do currículo mestre.
- **Dashboard Web Interativo (Realtime SSE):** Painel visual em `http://localhost:3000` com atualizações reativas instantâneas via Server-Sent Events (SSE) e File Watcher no `data/vagas.json`, badges de score, modal Notion de preview e botões de enfileiramento para o Agente CLI (sem polling contínuo e sem repaints desnecessários).
- **Sincronização em Planilha e JSON:** Exportação contínua para [vagas.csv](file:///C:/Users/Lucas/Desktop/CODE/AAA/curriculo/vagas.csv) (com BOM UTF-8 para Excel) e persistência em [data/vagas.json](file:///C:/Users/Lucas/Desktop/CODE/AAA/curriculo/data/vagas.json).
- **Camada Desacoplada de IA (AI Provider Layer):** Arquitetura plug-and-play que suporta motor local heurístico (offline), Google Gemini API e OpenAI/Groq/Ollama, preparando a solução para operar tanto via CLI quanto como SaaS.
- **Extração de Projetos (Feature B):** Processamento automático de pastas de projetos em `@new_project/project/` e `@new_project/OBSERVATIONS.md` para gerar resumos técnicos em `@new_exp/new/`.
- **Sincronização & Versionamento Mestre (Feature A):** Gestão incremental de versões imutáveis em `src/master/vX/` (`v1`, `v2`, `v3`, `v4`...), preservando snapshots históricos do candidato. Descoberta e resolução automática da versão mais recente via `automation/master_manager.js`.

---

## 📁 Estrutura do Projeto

- `/src/master`: Histórico de versões do currículo mestre (`v1/`, `v2/`, `v3/`, etc.), onde cada versão contém seu próprio `master_resume.html` e `master_resume.pdf`.
- `/data`: Estado persistente em JSON (`vagas.json`).
- `/vagas.csv`: Planilha de vagas compatível com Microsoft Excel e Google Sheets.
- `/archives`: Histórico de currículos gerados sob medida para vagas específicas (HTML e PDF de 1 pág).
- `/automation`: Módulos de automação:
  - `master_manager.js`: Descoberta dinâmica e resolução de versões do currículo mestre (`src/master/vX/`).
  - `linkedin_hunter.js`: Crawler em modo guest do LinkedIn.
  - `match_engine.js`: Extração de perfil, keywords e cálculo de score.
  - `spreadsheet_manager.js`: Persistência e deduplicação de CSV.
  - `job_store.js`: Armazenamento centralizado de vagas e controle de fila.
  - `ai_provider.js`: Adaptadores para múltiplos backends de IA.
  - `tailor_service.js`: Orquestrador de adaptação e injeção de CSS A4.
  - `generate_pdf.js`: Compilador Puppeteer com validação de página via `pdf-lib`.
  - `audit_pages.js`: Auditor de páginas para todo o repositório.
  - `server.js` & `/public`: Servidor HTTP nativo e Dashboard Web.
- `/new_project`: Sandbox para análise de novos projetos (`project/` e `OBSERVATIONS.md`).
- `/new_exp`: Resumos gerados de novas experiências (`new/` e `old/`).
- `/research`: Descrições de vagas e histórico de requisitos.
- `/test`: Suíte de testes unitários automatizados cobrindo todos os módulos.

---

## ⚡ Quick Start & Workflows

### 1. Iniciar o Painel Web Interativo
```bash
npm run server
```
Acesse `http://localhost:3000` para visualizar todas as vagas coletadas, status de geração, pontuação de match e previews.

### 2. Varredura On-Demand de Vagas (LinkedIn Hunter)
```bash
npm run hunt
```
- Coleta oportunidades recentes no LinkedIn sem autenticação.
- Calcula o score de compatibilidade contra a versão mestre ativa (resolvida dinamicamente via `automation/master_manager.js`, por padrão a maior versão em `src/master/vX/`).
- Vagas com **Match >= 90%** (ou priorizadas pela IA) são automaticamente marcadas na fila (`queued: true`) no painel e no `data/vagas.json`.
- Vagas com **Match < 90%** ficam registradas no dashboard e podem ser marcadas manualmente via botão **`+ Marcar p/ o Agente`**.

### 3. Fila de Geração e Criação sob Medida pelo Agente CLI
1. No painel web (`http://localhost:3000`), visualize as vagas coletadas e clique em **`+ Marcar p/ o Agente`** na oportunidade desejada (ou confira as já pré-enfileiradas com Match >= 90%).
2. No chat do Agente CLI, envie uma mensagem normal solicitando a criação (ex: *"Processe as vagas da fila"* ou *"Gere o currículo para a vaga da empresa X"*).
3. O Agente CLI analisa a descrição da vaga e o currículo mestre ativo, adapta o conteúdo com inteligência contextual em 1 página A4 sob medida, compila o PDF e atualiza `data/vagas.json`.
4. O status mudará instantaneamente para **"Currículo Gerado"** no painel web, habilitando os botões de visualização e download no dashboard.

### 4. Auditoria de Páginas
Para garantir que nenhum currículo arquivado ultrapasse o limite de uma página A4:
```bash
npm run audit
```

### 5. Execução dos Testes Automatizados (TDD)
```bash
npm test
```

---

## 🤖 Camada de Adaptação de IA (Pluggable Architecture)

O sistema conta com um padrão de adapter em [automation/ai_provider.js](file:///C:/Users/Lucas/Desktop/CODE/AAA/curriculo/automation/ai_provider.js):

- **LocalHeuristicProvider:** Motor padrão, 100% offline, com zero custo de tokens e resposta instantânea via regex semântico.
- **GeminiProvider:** Integração direta com a API do Google Gemini (`gemini-1.5-flash`).
- **OpenAiCompatibleProvider:** Integração com APIs compatíveis com o padrão OpenAI (Groq, DeepSeek, Ollama, OpenAI).
- **TailorService:** Orquestra a injeção dos requisitos da vaga e a calibração do CSS A4, mantendo a regra de página única inviolável.

---

## 🔒 Privacidade, Segurança e Integração de E-mails (Diretriz Estrita)

### 📧 Leitura Futura de E-mails (Status de Candidaturas)
Para a futura funcionalidade de monitoramento de respostas de processos seletivos via integração de e-mail:
- **Princípio da Whitelist Fechada:** O leitor de e-mails DEVE consultar e processar **exclusivamente** mensagens de remetentes, domínios ou assuntos diretamente associados a empresas registradas em [data/vagas.json](file:///C:/Users/Lucas/Desktop/CODE/AAA/curriculo/data/vagas.json).
- **Escopo Restrito:** Se o candidato aplicou apenas para vagas da Samsung, é terminantemente proibido ler, listar ou processar e-mails de quaisquer outras entidades (ex: Google, bancos, serviços pessoais ou newsletters).
- **Ações Ativas:** Nenhuma submissão ou envio de e-mails em nome do usuário será realizado de forma autônoma sem confirmação explícita.

### 🛡️ Proteção de Dados e Limpeza
- Este repositório é utilizado para versionamento pessoal. Caso utilize este framework como base para seus próprios currículos:
  - Limpe dados das pastas `/archives/` e `src/master/`.
  - Atualize ou crie sua versão mestre em `src/master/vX/master_resume.html` (o sistema detectará automaticamente a maior versão `vX`).

---
*Framework desenvolvido sob práticas de engenharia de software, TDD e automação orientada a agentes de IA.*
