# Fase 5 — Times, saída segura do mesário e acabamento

Plano de 24/09/2026. As Fases 1 a 4 estão na `main`, da `c686a09` à `c8c0083`. A Fase 5
junta duas sobras da Fase 4 (`useTeamDraft` e o README) com os problemas de uso que mais
aparecem na quadra.

**Não há migration nesta fase.** Nenhum item muda o banco: o deploy pode ir direto, depois
que a `202609240003` da Fase 4 estiver aplicada.

## Escopo

| # | Item | Por que agora |
|---|---|---|
| 1 | Regras dos times num lugar só (`teamRules.ts`) | O montador e o editor do mesário já divergem em cinco pontos |
| 2 | Sair do mesário sem deixar lances para trás | A fila só é enviada com o mesário aberto, e nada avisa ao sair |
| 3 | Duração da partida sem "7 min" fixo | O texto contradiz a duração configurada na rodada |
| 4 | Modais e avisos por cima do cabeçalho e da navegação | Botões ficam cobertos no celular |
| 5 | README e `AGENT.md` | O README ainda é o do starter do Astro |

---

## 1. Regras dos times num lugar só

O montador ([TeamBuilderIsland.tsx](../../src/components/live/TeamBuilderIsland.tsx)) e o
editor de times da noite
([EditNightTeamsModal.tsx](../../src/components/live/EditNightTeamsModal.tsx)) têm cópias
próprias das mesmas regras. A busca já foi unificada na Fase 4
([search.ts](../../src/lib/search.ts)). O resto divergiu:

| Regra | Montador | Editor do mesário | Servidor |
|---|---|---|---|
| Teto de 6 por time e 24 por rodada | Recusa ao adicionar ([l.298](../../src/components/live/TeamBuilderIsland.tsx#L298)) | Aceita o 7º; o erro só vem do servidor ao salvar ([l.203](../../src/components/live/EditNightTeamsModal.tsx#L203)) | `assertValidRoundFormat` recusa |
| Capitão desmarcado ou removido | O time volta ao nome da cor ([l.348](../../src/components/live/TeamBuilderIsland.tsx#L348), [l.379](../../src/components/live/TeamBuilderIsland.tsx#L379)) | O nome continua "Time &lt;ex-capitão&gt;" ([l.99](../../src/components/live/EditNightTeamsModal.tsx#L99), [l.187](../../src/components/live/EditNightTeamsModal.tsx#L187)) | — |
| Capitão movido para outro time | — | O time de origem fica com o nome dele ([l.149](../../src/components/live/EditNightTeamsModal.tsx#L149)) | — |
| Capitão obrigatório para salvar | Exige um por time ([l.595](../../src/components/live/TeamBuilderIsland.tsx#L595)) | Não exige | Não exige |
| PIN expirado (401) ao salvar | Aviso com link para o PIN; o rascunho fica ([l.637](../../src/components/live/TeamBuilderIsland.tsx#L637)) | Mostra o texto cru do middleware ([l.275](../../src/components/live/EditNightTeamsModal.tsx#L275)) | — |

**Proposta**

- Novo `src/components/live/teamRules.ts`, TypeScript puro ao lado de `teamDraft.ts` e
  `matchSync.ts`. As funções são genéricas sobre um time mínimo (`id`, `name`,
  `captainId`, `players`), para servir ao `TeamDraft` do montador e ao `LiveTeam` do
  editor. O módulo terá:
  - `TEAM_TEMPLATES`: os quatro coletes, hoje em `ALL_AVAILABLE_TEAMS`;
  - `defaultTeamName(colorHex)`: o nome pela cor do colete;
  - `canAddPlayer(teams, teamId)`: devolve a mensagem de recusa ou `null`, com as mesmas
    mensagens de `ROUND_RULES` dos dois lados;
  - `addPlayer`, `removePlayer`, `movePlayer`, `toggleCaptain` e `toggleGoalkeeper`;
  - `saveProblems(teams, { requireCaptain })`: time vazio, acima do teto e sem capitão.
- Quando o capitão sai, o nome volta para o da cor **só se ainda for o automático** ("Time
  &lt;capitão&gt;"). Um nome digitado à mão no editor fica como está.
- No 401, o editor mostra o aviso de sessão expirada e o link para o PIN, como o montador e
  o mesário. Pode reaproveitar o `AuthRequiredError` de `matchSync.ts`.
- **`useTeamDraft` vira só `teamRules.ts`.** O rascunho já é salvo pelo `teamDraft.ts`, e
  um hook só embrulharia os `setState`. Ele só entra se, depois da extração, sobrar
  duplicação nos componentes.

**Testes**

- `tests/team-rules.test.ts`: tetos, nome automático e nome à mão, capitão movido, goleiro
  e `saveProblems`.
- E2E: o editor recusa o 7º jogador no ato e mostra a mensagem do teto.

## 2. Sair do mesário sem deixar lances para trás

A fila de lances fica no aparelho e só é enviada com o mesário aberto
([MesarioSessionWrapper.tsx:82](../../src/components/live/MesarioSessionWrapper.tsx#L82)).
Algumas saídas deixam os lances parados no celular até ele voltar ao mesário, sem aviso
nenhum:

- um toque na navegação de baixo, que fica logo abaixo dos botões de gol durante a partida
  ([Layout.astro:223](../../src/layouts/Layout.astro#L223));
- um toque no cabeçalho;
- fechar a aba dentro da janela do "Desfazer".

**Proposta**

- `beforeunload` enquanto houver lance pendente, inclusive o gol retido pelo "Desfazer".
  O Safari do iPhone não mostra esse diálogo, por isso os dois pontos abaixo.
- Esconder a navegação de baixo enquanto houver partida em andamento. A ilha marca
  `document.documentElement.dataset.liveMatch` e o CSS do `Layout` esconde a barra. O
  link "Modo Mesário" do cabeçalho continua.
- Aviso em qualquer página: um banner no `Layout`, igual ao de sem conexão, diz "Há N
  lances deste aparelho ainda não enviados" e leva ao mesário. Ele lê as chaves
  `society_active_match_state:<sessionId>` do localStorage. Isso cobre o iPhone e quem
  fecha o app.
- Tirar a prop `hasLiveMatch` do `Layout`: nenhuma página a passa
  ([Layout.astro:10](../../src/layouts/Layout.astro#L10)).

**Testes**

- E2E no harness: com um lance pendente (offline), `page.close({ runBeforeUnload: true })`
  dispara o diálogo `beforeunload`; sem pendência, não dispara.
- O banner e a barra escondida ficam no `Layout`, que o harness não carrega (ele é um SPA
  do Vite). Verificação manual até o e2e rodar no Astro real (Fase 6).

## 3. Duração da partida sem "7 min" fixo

A duração é escolhida por rodada (`sessions.match_duration_seconds`), mas três textos
dizem 7 minutos:

- o selo "Tempo Oficial (7 min)" no card do histórico
  ([MatchHistoryCard.astro:94](../../src/components/ui/MatchHistoryCard.astro#L94)). O card
  já mostra a duração real jogada, então o selo vira "Tempo regulamentar";
- o rodapé "7 min ou 2 gols" do card PNG da rodada
  ([RoundSummaryCard.tsx:397](../../src/components/export/RoundSummaryCard.tsx#L397)). O
  `GetRoundHighlightsUseCase` já tem a sessão
  ([l.79](../../src/core/application/use-cases/GetRoundHighlightsUseCase.ts#L79)): o
  `RoundHighlightsOutputDTO` ganha `matchDurationSeconds`, e os "2 gols" vêm de
  `MATCH_RULES.MAX_GOALS_FOR_VICTORY`;
- a descrição da página do mesário, "cronômetro de 7 minutos"
  ([mesario.astro:72](../../src/pages/rodada/mesario.astro#L72)), que perde o número.

**Testes:** caso de uso da rodada devolvendo a duração da sessão; card renderizado com 8
minutos.

## 4. Modais e avisos por cima do cabeçalho e da navegação

O `<main>` é `relative z-10` ([Layout.astro:210](../../src/layouts/Layout.astro#L210)) e cria
um contexto de empilhamento. Um `fixed z-50` dentro dele não passa por cima do cabeçalho
(`z-40`) nem da navegação de baixo (`z-50`), que estão fora. Afetados:

- o modal "Novo avulso" do montador
  ([TeamBuilderIsland.tsx:1278](../../src/components/live/TeamBuilderIsland.tsx#L1278));
- o `EditPlayerModal` ([EditPlayerModal.tsx:80](../../src/components/ui/EditPlayerModal.tsx#L80));
- os avisos de "exportado" dos cards, em `top-5`, embaixo do cabeçalho de 64 px
  ([PeriodLeaderboardCard.tsx:205](../../src/components/export/PeriodLeaderboardCard.tsx#L205),
  [RoundSummaryCard.tsx:116](../../src/components/export/RoundSummaryCard.tsx#L116)).

**Proposta:** os dois modais passam pelo `ModalPortal`, que já dá foco preso, Esc e
`z-[100]`. Os avisos usam um portal para o `body`, num componente pequeno em
`components/ui/`.

**Testes:** a `touch.spec` já abre os dois modais. Ela passa a conferir, com
`document.elementFromPoint`, que os botões do rodapé do modal recebem o toque a 360 × 640,
como a `assist.spec` faz com a gaveta.

## 5. README e `AGENT.md`

**README**, no lugar do starter:

- o que é o app e a stack;
- como rodar: `npm ci`, `.env` a partir do `.env.example` e para que serve cada variável;
- os scripts: `dev`, `check`, `check:astro`, `lint`, `format`, `test`, `test:e2e`,
  `build` e `db:*`;
- o deploy: a Vercel publica a `main`, o `vercel-build` roda tipos e testes antes, e a
  migration vai ao banco antes do push;
- PWA e cache: o SW só é registrado no build, `VERSION` do `sw.js` muda quando a
  estratégia muda, os ícones saem de `node scripts/icons.mjs`, e `PUBLIC_CACHE_CONTROL`
  vale para as páginas públicas;
- links para `AGENT.md`, o ADR 0001, `supabase/README.md` e `docs/`.

**`AGENT.md`**, nos pontos em que diverge do código:

- a chave do mesário no localStorage é `society_active_match_state:<sessionId>`, e não a
  chave única;
- o schema de verdade são as migrations, a partir da baseline `202608140000`, e não o
  spec 04;
- os alvos de toque são de 44 × 44 e os campos de 16 px, conferidos pela `touch.spec`;
- a validação passa a ser `npm run lint`, `check`, `test` e `test:e2e`, e não só
  `npx tsc --noEmit`;
- as fases seguem os planos das fases, e não o `06_IMPLEMENTATION_ROADMAP.md`;
- migrations só por `npm run db:*`, com `REVOKE … FROM PUBLIC, anon, authenticated` em
  toda função nova.

Os arquivos de `society-tracker-specs/` continuam sem alteração, como nas fases
anteriores.

---

## Decisões a confirmar

1. **Capitão no editor do mesário:** proposta de **não exigir** para salvar, porque o
   capitão pode ir embora no meio da noite. O editor só mostra quais times estão sem
   capitão.
2. **Nome do time quando o capitão sai:** volta para a cor só se for o nome automático. O
   nome digitado à mão fica.
3. **Navegação de baixo durante a partida:** esconder (proposta) ou manter, contando só com
   o aviso.
4. **Banner de lances pendentes em qualquer página:** entra (proposta) ou fica só o
   `beforeunload`.

## Ordem e commits

Um commit por item, nesta ordem: 1 (a maior mudança, com testes próprios), 2, 3, 4 e 5. O
item 5 fecha a fase porque descreve o estado final.

## Verificação

- `npm run lint`, `npm run format:check`, `npm run check`, `npm run check:astro`,
  `npm test`, `npm run test:e2e` e `npm run build`.
- Testes novos: `team-rules.test.ts`, o editor recusando o 7º jogador, o diálogo de
  `beforeunload`, os modais recebendo o toque na `touch.spec`, e a duração no caso de uso
  da rodada.
- Manual no celular, depois do deploy:
  - com uma partida em andamento, a barra de baixo some;
  - offline, registrar um gol e abrir outra página: aparece o banner de lance pendente;
  - "Novo avulso" e "Editar atleta" abrem por cima da barra;
  - o card PNG da rodada mostra a duração configurada.

## Fora do escopo (Fase 6 ou depois)

- Paginação ou agregação no banco para `/historico` e `/relatorios`, e o ranking da
  `index.astro` num caso de uso: hoje as duas primeiras carregam o histórico inteiro.
- Composition root (cada rota faz `new Supabase*Repository()`) e tipos gerados do
  Supabase.
- E2E no Astro real, e não no SPA do Vite: cobriria o `Layout`, o service worker, as
  páginas `.astro` na auditoria de toque e o banner do item 2.
- As duas falhas intermitentes do e2e vistas na Fase 4 (`live.spec` e `assist.spec`): o
  harness ficou sem o React montar, e a causa não foi encontrada.
- Observabilidade: Sentry, `/api/health` e conferência da versão do schema na
  inicialização.
- Modelo de RLS: hoje toda consulta usa a service role.
- Cronômetro e elencos compartilhados entre dois aparelhos.
- Ajustes pequenos que podem entrar se sobrar tempo:
  - fontes do Google carregadas duas vezes, pelo `@import` do
    [globals.css](../../src/styles/globals.css) e pelo `<link>` do `Layout`;
  - `html-to-image` só carregado ao exportar, com `import()` dinâmico;
  - "Sair" no celular;
  - imagem do preview do WhatsApp: o `og-society-tracker.png` não existe;
  - `motion-reduce`;
  - opção de desligar o som.
