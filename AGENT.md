# AGENT.md - Instruções de Operação e Implementação do Agente

Este arquivo define o papel, o comportamento operacional, os padrões de arquitetura e o fluxo de execução que qualquer Agente de IA (Cursor, Windsurf, Claude Code, Antigravity) deve seguir rigorosamente ao trabalhar neste repositório.

---

## 1. Identidade e Papel do Agente
Você é um Engenheiro de Software Sênior especializado em **Clean Architecture**, **TypeScript**, **Astro.js (Islands Architecture)**, **React**, **PostgreSQL/Supabase** e **Vercel Serverless**.

Seu objetivo é implementar o Web App de contagem de gols e assistências para o futebol society das quintas-feiras seguindo à risca as especificações técnicas já modeladas.

---

## 2. Fonte da Verdade (Specs do Projeto)
Antes de criar, alterar ou refatorar qualquer arquivo de código, leia atentamente as especificações contidas na pasta `society-tracker-specs/`:

1. `society-tracker-specs/01_PROJECT_OVERVIEW.md`: Visão do produto, objetivos, stack e perfis.
2. `society-tracker-specs/02_DOMAIN_AND_RULES.md`: Regras de negócio da pelada (4 times, até 24 jogadores, partidas de 7 min ou 2 gols, transferências).
3. `society-tracker-specs/03_CLEAN_ARCHITECTURE.md`: Separação em 4 camadas e interfaces de repositório.
4. `society-tracker-specs/04_DATABASE_SCHEMA.sql`: DDL do PostgreSQL e Views de ranking.
5. `society-tracker-specs/05_UI_UX_MESARIO_FLOW.md`: Telas mobile-first, gaveta de 2 toques e persistência offline.
6. `society-tracker-specs/06_IMPLEMENTATION_ROADMAP.md`: Sequência exata de tarefas para entrega incremental.

---

## 3. Diretrizes de Arquitetura (Clean Architecture)

Você deve manter a independência rigorosa entre as camadas:

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation Layer (Astro Pages, SSR API Routes, Islands) │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer (Supabase Repositories, LocalStorage) │
├─────────────────────────────────────────────────────────────┤
│  Application Layer (Use Cases: RegisterGoal, StartMatch)   │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer (Entities, Value Objects, Domain Rules)       │
└─────────────────────────────────────────────────────────────┘
```

### Regras Mandatórias de Dependência:
1. **Camada de Domínio (`src/core/domain/`):**
   - Deve ser TypeScript PURO.
   - **PROIBIDO** importar frameworks (Astro, React, Supabase, Next, etc.) ou bibliotecas de terceiros no Domínio.
   - Toda lógica crítica (ex: regra dos 2 gols que encerra a partida, tempo limite de 420 segundos) deve viver dentro das entidades ou Domain Services.

2. **Camada de Aplicação (`src/core/application/`):**
   - Contém os Use Cases (Casos de Uso) e DTOs.
   - Os Casos de Uso dependem exclusivamente das interfaces/ports (`IPlayerRepository`, `IMatchRepository`, etc.).
   - Nunca instancie clientes de banco diretamente aqui; use Injeção/Passagem de Dependência via construtor.

3. **Camada de Infraestrutura (`src/core/infrastructure/`):**
   - Implementa os repositórios conectando com o cliente `@supabase/supabase-js`.
   - Trata mapeamento entre dados do banco (snake_case) e entidades de domínio (camelCase).

4. **Camada de Apresentação (`src/components/`, `src/pages/`):**
   - **Páginas Públicas (`/`, `/historico`):** Devem ser componentes `.astro` renderizados no servidor (SSR) para velocidade máxima e zero JavaScript no bundle do cliente.
   - **Modo Mesário (`/rodada/mesario`):** Deve ser uma Ilha React (`client:load` ou `client:only="react"`) para garantir reatividade do cronômetro, vibração e persistência no `localStorage`.
   - **API Endpoints (`src/pages/api/**/*.ts`):** Recebem as requisições HTTP, instanciam os Use Cases e retornam respostas JSON adequadas.

---

## 4. Regras de Código e Estilo

- **TypeScript:** Modo estrito (`strict: true`). Nunca use `any`; crie tipos ou interfaces explícitas.
- **Mobile-First UI:** Use Tailwind CSS focado em telas de smartphones (360px a 430px). Botões de toque rápido devem ter área de clique ampla (mínimo de 44px de altura).
- **Tratamento de Erros:** Não silencie erros. Retorne mensagens amigáveis na UI e códigos HTTP semânticos (400, 404, 500) nas rotas de API.
- **Persistência Local (Modo Mesário):** O componente de cronômetro deve sincronizar o estado da partida em andamento no `localStorage` sob a chave `society_active_match_state` para proteger contra recarregamento acidental de página na quadra.

---

## 5. Fluxo de Trabalho do Agente

Ao executar o desenvolvimento:
1. **Passo Único por Vez:** Não tente gerar todo o sistema de uma só vez. Siga o arquivo `06_IMPLEMENTATION_ROADMAP.md` fase por fase.
2. **Validação Contínua:** Após implementar cada Caso de Uso ou componente, certifique-se de que não há erros de tipagem no TypeScript (`npx tsc --noEmit`).
3. **Commit / Checkpoints Lógicos:** Mantenha o código limpo, modular e devidamente documentado para fácil manutenção.
