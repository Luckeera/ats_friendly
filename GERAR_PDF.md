# Como Gerar PDF a partir de HTML

## Ambiente
- Windows 11
- Microsoft Edge instalado em `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`

## Workflow de Candidatura (Passo a Passo)

1. **Análise da Vaga:** Analisar o arquivo presente em `vagas/vaga_atual/` para identificar palavras-chave, requisitos técnicos e diferenciais.
2. **Otimização ATS:** Adaptar o currículo base (`resume_br.html`) criando uma versão específica focada na vaga.
   - Ajustar Título Profissional.
   - Refinar Resumo Profissional com keywords da vaga.
   - Reordenar/Destacar Habilidades Técnicas.
   - Adaptar bullets de experiências para dar match com os requisitos.
3. **Organização:** Salvar o novo HTML em uma subpasta dentro de `resume's/` (ex: `resume's/nome_da_empresa/`).
4. **Geração do PDF:** Executar o comando do Edge para gerar o PDF na mesma pasta.
5. **Validação:** Verificar se o PDF foi gerado corretamente e se o conteúdo reflete as mudanças.

## Comando para Gerar PDF (PowerShell)

```powershell
powershell.exe -Command "& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless --disable-gpu --no-pdf-header-footer --print-to-pdf='CAMINHO_DO_PDF' 'file:///CAMINHO_DO_HTML'"
```

## Notas Técnicas
- **Caminhos com Espaços/Apóstrofos:** No PowerShell, use aspas duplas ao redor do comando e escape caminhos complexos.
- **Caminho do HTML:** Deve usar o formato `file:///` com barras normais `/`.
- **Timeout:** Aguardar ~2 segundos após o comando para garantir que o arquivo foi escrito no disco.

## Diretrizes de Otimização para ATS (Applicant Tracking Systems)

Para garantir que o currículo seja lido corretamente por sistemas automatizados:

1. **Estrutura Simples:** Use apenas uma coluna. Evite tabelas, gráficos, imagens ou colunas complexas que possam confundir o parser.
2. **Títulos de Seção Padrão:** Utilize termos comuns como "Resumo Profissional", "Experiência Profissional", "Habilidades Técnicas" e "Formação Acadêmica".
3. **Palavras-Chave (Keywords):** Identifique os termos técnicos (hard skills) na descrição da vaga e insira-os organicamente no resumo e na lista de habilidades.
4. **Formatação de Texto:** Use fontes padrão (Arial, Calibri, Helvetica). O HTML deve ser semântico (h1, h2, div, p, ul, li).
5. **Dados de Contato:** Devem estar no topo, de fácil acesso, sem estar dentro de cabeçalhos ou rodapés complexos.
6. **Verbos de Ação:** Comece os bullets de experiência com verbos de ação (ex: "Desenvolvi", "Liderou", "Otimizou").
7. **Resultados Quantificáveis:** Sempre que possível, inclua métricas (ex: "redução de 20% nos custos", "aumento de 40% na performance").