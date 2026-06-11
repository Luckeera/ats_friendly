# Gemini CLI Project Mandates - Resume-as-Code

## Core Constraints
- **One-Page Limit:** Every resume generated for a specific job application MUST fit on a single A4 page.
- **Experience Filtering:** Do not attempt to include the full `master_resume.html` content. Selectively filter and include only the professional experiences, projects, and skills that directly align with the target job description in `./research/current/vaga.md`.
- **ATS Optimization:** Maintain the single-column structure and standard semantic naming conventions defined in the master templates.

## Workflow Integration
- When performing "Feature A" (Master Sync), ensure the `master_resume.html` remains the comprehensive source of truth, even if it exceeds one page. The one-page limit only applies to individual job applications in `/archives`.
- When generating a PDF, always verify that the visual output remains professional and fits the single-page constraint.
