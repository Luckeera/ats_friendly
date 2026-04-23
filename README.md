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

## 🛠️ Como Usar

1. **Analise a Vaga:** Coloque a descrição da vaga em `/research/current/vaga.md`.
2. **Adapte o Template:** Ajuste o arquivo em `/src/resume_br.html` com as palavras-chave identificadas.
3. **Gere o PDF:**
   ```powershell
   # Exemplo via CLI (PowerShell + Edge)
   ./automation/generate_pdf.ps1 -Input "./src/resume_br.html" -Output "./archives/empresa_vaga/resume.pdf"
   ```

## 🧠 Filosofia de Design (ATS-Friendly)

Este projeto segue as melhores práticas de otimização para sistemas automáticos:
- Estrutura de coluna única para evitar erros de parsing.
- Uso de fontes padrão do sistema.
- Seções nomeadas com termos padrão da indústria.
- Ausência de elementos gráficos complexos (tabelas/imagens) que bloqueiam a extração de dados.

---
*Este repositório é parte de um esforço contínuo para aplicar princípios de engenharia no desenvolvimento de carreira.*
