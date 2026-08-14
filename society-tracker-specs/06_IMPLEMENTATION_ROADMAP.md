# 06 - Roteiro de Implementação Passo a Passo (Agent Roadmap)

Este roteiro deve ser seguido sequencialmente pelo agente de desenvolvimento para construir o projeto do zero até o deploy na Vercel.

---

## Fase 1: Setup do Projeto e Banco de Dados
- [x] **Passo 1.1:** Inicializar projeto Astro com TypeScript:
  ```bash
  npm create astro@latest society-tracker -- --template minimal --typescript strict
  ```
- [x] **Passo 1.2:** Instalar integrações oficiais:
  ```bash
  npx astro add vercel react tailwind
  npm install @supabase/supabase-js lucide-react clsx tailwind-merge
  ```
- [x] **Passo 1.3:** Configurar `astro.config.mjs` com `output: 'server'` e adapter da Vercel.
- [x] **Passo 1.4:** Executar o script DDL `04_DATABASE_SCHEMA.sql` no painel SQL do Supabase.
- [x] **Passo 1.5:** Configurar as variáveis de ambiente `.env`:
  ```env
  PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
  ```

---

## Fase 2: Implementação do Core (Clean Architecture)
- [x] **Passo 2.1:** Criar entidades em `src/core/domain/entities/`:
  - `Player.ts`, `Session.ts`, `Team.ts`, `Match.ts`, `MatchEvent.ts`.
- [x] **Passo 2.2:** Definir interfaces de repositório em `src/core/domain/repositories/`:
  - `IPlayerRepository.ts`, `ISessionRepository.ts`, `IMatchRepository.ts`.
- [x] **Passo 2.3:** Implementar Casos de Uso em `src/core/application/use-cases/`:
  - `RegisterGoalUseCase.ts` (com regra de 2 gols).
  - `StartMatchUseCase.ts`.
  - `FinishMatchUseCase.ts`.
  - `GetLeaderboardUseCase.ts`.
- [x] **Passo 2.4:** Implementar adaptadores Supabase em `src/core/infrastructure/repositories/`.

---

## Fase 3: Ilhas Interativas do Modo Mesário
- [x] **Passo 3.1:** Construir o componente `MatchTimer.tsx` (contagem regressiva de 7 min com som/vibração).
- [x] **Passo 3.2:** Construir o componente `GoalDrawer.tsx` (gaveta inferior rápida em 2 toques).
- [x] **Passo 3.3:** Construir o componente `LiveScoreboard.tsx` integrando cronômetro, placar, persistência em `localStorage` e chamadas de API.
- [x] **Passo 3.4:** Criar modal de transferência/empréstimo de jogador entre times.

---

## Fase 4: Telas Astro (SSR) e Endpoints de API
- [x] **Passo 4.1:** Criar `src/pages/api/matches/[id]/goals.ts` chamando `RegisterGoalUseCase`.
- [x] **Passo 4.2:** Criar `src/pages/rodada/nova.astro` (seleção dos presentes e montagem dos 4 times).
- [x] **Passo 4.3:** Criar `src/pages/rodada/mesario.astro` carregando `<LiveScoreboard client:load />`.
- [x] **Passo 4.4:** Criar `src/pages/index.astro` (Leaderboard público: Artilharia, Garçons, Pódio).
- [x] **Passo 4.5:** Criar `src/pages/historico.astro` (Histórico de jogos por quinta-feira).

---

## Fase 5: Testes, Otimização e Deploy
- [x] **Passo 5.1:** Testar regras unitárias de domínio (vitória com 2 gols, estouro de tempo).
- [x] **Passo 5.2:** Testar comportamento responsivo no navegador em modo mobile.
- [x] **Passo 5.3:** Deploy na Vercel e validação em ambiente real de produção.
