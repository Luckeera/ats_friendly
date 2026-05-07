# 🚀 Astros | Projeto para Portfólio

Este documento contém o resumo técnico e os destaques do projeto **Astros**, estruturados para serem utilizados em currículos, LinkedIn ou sites de portfólio.

---

## 📋 Resumo (Pitch)
**Astros** é uma rede social acadêmica interdisciplinar projetada para conectar estudantes e facilitar a colaboração em projetos através de "Idea Pitches". A plataforma resolve o problema de isolamento entre cursos (silos acadêmicos), permitindo que ideias nasçam de forma colaborativa e cross-funcional.

---

## 🛠 Tech Stack

### Backend
- **Linguagem:** Python 3.10+
- **Framework:** FastAPI (Alta performance e tipagem forte)
- **Banco de Dados:** SQLite (Desenvolvimento) com SQLModel (SQLAlchemy + Pydantic)
- **Segurança:** Autenticação OAuth2 com JWT (JSON Web Tokens)

### Frontend
- **Linguagem:** JavaScript / React (Vite)
- **Estilização:** TailwindCSS (Design system moderno e responsivo)
- **Ícones:** Lucide React
- **Estado/API:** React Context API e Service Layer pattern (Fetch API)

---

## 🏆 Experiência e Impacto (Método STAR)

- **Arquitetura Full-Stack Autônoma:** Projetei e implementei a aplicação de ponta a ponta, desde a modelagem de dados relacional até a interface responsiva, garantindo uma experiência de usuário fluida e consistente com o objetivo de facilitar o networking acadêmico.
- **Modelagem de Dados Avançada:** Estruturei um banco de dados complexo utilizando SQLModel, implementando relacionamentos *Many-to-Many* para visibilidade segmentada de posts e modelos autorreferenciados para suportar threads de comentários aninhados com alta performance.
- **Sistema de Colaboração e Fluxo de Trabalho:** Desenvolvi um motor de "Pitches" com lógica de negócio personalizada, incluindo solicitações de colaboração com mensagens de apresentação integradas e controle de status (pendente/aceito), centralizando a comunicação em tempo real.
- **Segurança e Consumo de API:** Implementei autenticação robusta via JWT no backend e um service layer centralizado no frontend, otimizando o gerenciamento de estado e a segurança das transações entre cliente e servidor.

---

## 🧠 O Desafio Técnico

**Problema:** Implementar a visibilidade interdisciplinar, onde um post pode ser direcionado a múltiplos cursos específicos e filtrado de forma eficiente.

**Solução:** Desenvolvi um modelo de ligação (*link model*) em SQLModel para gerenciar as relações *Many-to-Many* entre `Post` e `Course`. Para evitar o problema de performance N+1 nas consultas, utilizei a estratégia `selectinload` do SQLAlchemy, permitindo que feeds complexos sejam carregados com o mínimo de chamadas ao banco de dados, garantindo uma interface rápida mesmo com grandes volumes de dados.

---

## 💡 Dicas para a Entrevista

1. **Fale sobre Autonomia:** Destaque que, ao atuar sozinho, você teve que tomar decisões de design de UI, arquitetura de sistemas e gerenciamento de banco de dados.
2. **Decisões Técnicas:** Esteja pronto para explicar por que usou **SQLModel** (unifica Pydantic e SQLAlchemy, reduzindo código duplicado) e **TailwindCSS** (velocidade de prototipagem e consistência visual).
3. **Escalabilidade:** Comente que a arquitetura em routers e o service layer no frontend facilitam a expansão do projeto para novas funcionalidades.

---

*Documento gerado para auxiliar na apresentação profissional do projeto Astros.*
