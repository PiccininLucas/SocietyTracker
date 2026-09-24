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

As specs são a especificação original e não são atualizadas. Onde divergem do código, vale o código:

- **Schema:** a verdade são as migrations em `supabase/migrations/`, a partir da baseline `202608140000_baseline.sql`, e não o `04_DATABASE_SCHEMA.sql`. Como aplicar: `supabase/README.md`.
- **Formato da rodada:** 3 ou 4 times de até 6 jogadores, com teto de 24 (`ROUND_RULES`). A duração da partida é escolhida por rodada no montador (`sessions.match_duration_seconds`); os 7 minutos são só o padrão.
- **Histórico das mudanças:** `docs/fases/README.md` registra o que cada fase de melhoria mudou e o que está pendente.

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
   - Toda lógica crítica (ex: regra dos 2 gols que encerra a partida, tempo limite da rodada, 420 segundos por padrão) deve viver dentro das entidades ou Domain Services.
   - **Exceção — escrita de partida:** as regras de escrita da partida vivem na transação SQL `society_match_command`, e o domínio TS guarda as regras de leitura e as constantes (`MATCH_RULES`). Ver `docs/adr/0001-transacao-sql-e-a-autoridade-das-partidas.md`.

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
- **Mobile-First UI:** Use Tailwind CSS focado em telas de smartphones (360px a 430px). Todo botão, link e campo tem pelo menos 44 × 44 px, e todo campo de texto, número, data ou select tem fonte de pelo menos 16px (abaixo disso o iPhone dá zoom ao focar). A `tests/ui/touch.spec.ts` confere as duas regras nas ilhas React.
- **Modais e avisos flutuantes:** use o `ModalPortal` (ou um portal para o `body`, como o `Toast`). Dentro do `<main>` do Layout, que é `relative z-10`, um `fixed z-50` fica embaixo do cabeçalho e da navegação de baixo.
- **Tratamento de Erros:** Não silencie erros. Retorne mensagens amigáveis na UI e códigos HTTP semânticos (400, 404, 500) nas rotas de API.
- **Persistência Local (Modo Mesário):** O mesário guarda no `localStorage`, sob a chave `society_active_match_state:<sessionId>` (uma por rodada), a fila de lances ainda não enviados, os cronômetros e as partidas confirmadas (`matchSync.ts`). Isso protege contra recarga na quadra e contra a falta de sinal. A chave única antiga, `society_active_match_state`, só é lida para preservar registros da versão anterior.

---

## 5. Fluxo de Trabalho do Agente

Ao executar o desenvolvimento:
1. **Passo Único por Vez:** Não tente gerar todo o sistema de uma só vez. O trabalho segue os planos das fases em `docs/fases/` (um `FASE_N.md` por fase), e não mais o `06_IMPLEMENTATION_ROADMAP.md`. Ao fechar uma fase, atualize o `FASE_N.md` e a tabela de situação do `docs/fases/README.md`.
2. **Validação Contínua:** Antes de cada commit, rode `npm run lint`, `npm run format:check`, `npm run check` e `npm test`. Ao mexer em tela ou arquivo `.astro`, rode também `npm run test:e2e` e `npm run check:astro`. O CI roda tudo isso e o build.
3. **Migrations:** só por `npm run db:*` (`scripts/db.mjs`), nunca pelo SQL Editor nem pelo CLI do Supabase. Toda função nova termina com `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;` e `GRANT EXECUTE … TO service_role;`: no Supabase, `REVOKE … FROM PUBLIC` sozinho não tira o acesso da chave pública. A migration vai ao banco antes do deploy do código que depende dela. Ver `supabase/README.md`.
4. **Commit / Checkpoints Lógicos:** Mantenha o código limpo, modular e devidamente documentado para fácil manutenção.
