# Resume-as-Code & ATS Optimization Framework

Este repositório contém um sistema de gerenciamento de currículos focado em **automação**, **versionamento** e **otimização para ATS** (Applicant Tracking Systems). 

Em vez de editar arquivos estáticos, este projeto utiliza uma abordagem baseada em templates HTML/CSS para gerar currículos profissionais em PDF, garantindo que cada candidatura seja personalizada e tecnicamente otimizada.

## 🚀 Funcionalidades

- **Templates Semânticos:** Currículos estruturados em HTML5 puro, otimizados para leitura por parsers de IA e sistemas de recrutamento.
- **Automação de PDF:** Geração de PDFs via Headless Browser (Edge/Puppeteer), garantindo fidelidade visual e seleção de texto perfeita.
- **Versionamento de Candidaturas:** Histórico completo de versões customizadas para diferentes vagas e perfis (Engenharia de Dados, Backend Python, etc).
- **Pesquisa de Mercado:** Repositório centralizado de descrições de vagas para análise de tendências de keywords.

## 📁 Estrutura do Projeto

- `/src`: Templates base e arquivos fonte HTML.
- `/research`: Descrições de vagas e análise de requisitos.
- `/archives`: Histórico de currículos gerados para candidaturas específicas.
- `/automation`: Scripts para conversão de HTML para PDF.

## ⚡ Quick Start (AI Workflow)

Este repositório foi desenhado para ser operado por agentes de IA. Para gerar um novo currículo otimizado, siga este protocolo:

1. **Input:** Atualize o arquivo `./research/current/vaga.md` com a descrição da vaga desejada.
2. **Execution:** Forneça a seguinte instrução para a IA CLI:
   > "Leia o README, analise a vaga em `./research/current/vaga.md` e o template em `./src/resume_br.html`. Crie uma versão otimizada para ATS na pasta `./archives/[NOME_DA_EMPRESA]`, ajuste os pontos técnicos para dar match com os requisitos e gere o PDF usando o script em `./automation/generate_pdf.ps1`."

---

## 🤖 AI-Assisted Content Optimization

O coração deste projeto é a integração entre automação de documentos e **Inteligência Artificial**. O processo de otimização utiliza LLMs (via CLI ou API) para:

1. **Extração de Entidades:** Identificação automática de Hard Skills e requisitos críticos em descrições de vagas brutas.
2. **Refatoração Semântica:** Reescrita de experiências profissionais para alinhar a terminologia do currículo com a cultura técnica da empresa alvo.
3. **Keyword Gap Analysis:** Comparação entre o template base e a vaga para garantir que o parser do ATS atinja o score máximo de relevância.

---

## 🛠️ Toolchain

- **Engine:** Microsoft Edge / Puppeteer (PDF Rendering)
- **Scripting:** PowerShell / Node.js
- **Intelligence:** AI CLI (Gemini/GPT-4) para processamento de linguagem natural.
- **Markup:** HTML5 semântico e CSS3.

## 🧠 Filosofia de Design (ATS-Friendly)

Este projeto segue as melhores práticas de otimização para sistemas automáticos:
- Estrutura de coluna única para evitar erros de parsing.
- Uso de fontes padrão do sistema.
- Seções nomeadas com termos padrão da indústria.
- Ausência de elementos gráficos complexos (tabelas/imagens) que bloqueiam a extração de dados.

---
*Este repositório é parte de um esforço contínuo para aplicar princípios de engenharia no desenvolvimento de carreira.*
