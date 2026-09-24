# Fase 5 — Times, saída segura do mesário e acabamento (24/09/2026)

**Commits:** de `d6a2db1` a `f2580fa`, mais o commit de documentação que fecha a fase
(24/09). **Plano original:** [planos/2026-09-24-fase-5.md](planos/2026-09-24-fase-5.md).
Ele parte da proposta que estava neste arquivo até o commit `4d4f1e7`.

## Escopo

A fase juntou as duas sobras da Fase 4 (`useTeamDraft` e o README) com os problemas de uso
que mais aparecem na quadra:

| # | Item | Commit |
|---|---|---|
| 1 | Regras dos times num lugar só | `d6a2db1` |
| 2 | Sair do mesário sem deixar lances para trás | `0339894` |
| 3 | Duração da partida sem "7 min" fixo | `1e672bb` |
| 4 | Modais e avisos por cima do cabeçalho e da navegação | `f2580fa` |
| 5 | README, `AGENT.md` e este registro | commit de documentação |

**Não houve migration.** Nenhum item mudou o banco.

## O que foi feito, por commit

### `d6a2db1` — Regras dos times num lugar só

O montador e o editor de times do mesário tinham cópias próprias das mesmas regras, e elas
tinham divergido: o editor aceitava o 7º jogador (o erro só vinha do servidor ao salvar),
deixava "Time &lt;ex-capitão&gt;" depois que o capitão saía, não exigia capitão e mostrava o
texto cru do middleware no 401.

- **[teamRules.ts](../../src/components/live/teamRules.ts):** TypeScript puro sobre um time
  mínimo, usado pelas duas telas. O `captainId` é a única fonte de verdade sobre o capitão.
  - `TEAM_TEMPLATES`: os quatro coletes, que saíram do montador;
  - `canAddPlayer`: 6 por time sempre, e 24 por rodada só para quem ainda não está em time
    nenhum, porque mover não muda o total;
  - `addPlayer`, `removePlayer`, `movePlayer`, `toggleCaptain`, `toggleGoalkeeper` e
    `updatePlayer`, que cobre o capitão renomeado no cadastro;
  - `saveProblems`: nome vazio, time vazio, acima de 6, acima de 24 e sem capitão.
- **Nome do time:** segue o capitão só enquanto é automático (o da cor ou "Time
  &lt;capitão&gt;"). Um nome digitado à mão no editor fica quando o capitão sai e quando um
  capitão novo é marcado.
- **Editor do mesário:**
  - recusa no ato adicionar ou mover para um time cheio;
  - mostra "Sem capitão" em cada time sem capitão e exige um por time para salvar;
  - no 401, dá o link para o PIN;
  - trata a falha de rede com o `describeNetworkError`;
  - ao abrir, normaliza o `captainId`, porque rodadas antigas podem ter só o `isCaptain`
    do jogador.
- **Montador:** o "Nenhum" da lista de presença zerava só os jogadores e deixava o capitão
  e o "Time X" num time vazio. Agora ele refaz os times pelos templates. O `defaultName`
  saiu do `TeamDraft`.
- **`useTeamDraft` não foi criado.** O rascunho já é salvo pelo `teamDraft.ts`, e depois da
  extração não sobrou duplicação nos componentes que justificasse um hook.

### `0339894` — Sair do mesário sem deixar lances para trás

A fila de lances só é enviada com o mesário aberto. Um toque na navegação de baixo, logo
abaixo dos botões de gol, ou fechar a aba dentro da janela do "Desfazer" deixava lances
parados no celular, sem aviso.

- **`beforeunload`** enquanto a aba dona da fila tem algo pendente, inclusive o gol retido
  pelo "Desfazer". O "Entrar com o PIN" fica de fora, porque o login volta ao mesário e a
  fila recomeça.
- **Navegação de baixo:** some durante a partida em andamento. A ilha marca
  `data-live-match` no `<html>`, e o `globals.css` esconde o `#mobile-nav`. O "Modo Mesário"
  do cabeçalho continua.
- **Banner em toda página, menos no mesário:** "Há N lances deste aparelho ainda não
  enviados", com o link para `/rodada/mesario?sessionId=<rodada>`. Ele lê as chaves por
  rodada pelo [pendingOnDevice.ts](../../src/lib/pendingOnDevice.ts), que não importa nada
  para o script do Layout continuar pequeno, e se atualiza no `storage` e no `pageshow`.
  Cobre o iPhone, cujo Safari não mostra o diálogo do `beforeunload`.
- **O banner fica dentro do cabeçalho fixo.** Na primeira versão ele ficava abaixo dele. Na
  verificação no build real, uma recarga com a página rolada fazia a ancoragem de rolagem
  do navegador esconder o banner atrás do cabeçalho.
- A prop `hasLiveMatch` saiu do `Layout`: nenhuma página a passava.

### `1e672bb` — Duração da partida sem "7 min" fixo

A duração é escolhida por rodada (`sessions.match_duration_seconds`), mas três textos
diziam 7 minutos:

- **rodapé do card PNG da rodada:** o `RoundHighlightsOutputDTO` ganhou
  `matchDurationSeconds`, que vem da sessão, e os "2 gols" vêm de `MATCH_RULES`;
- **selo do card do histórico:** "Tempo Oficial (7 min)" virou "Tempo regulamentar";
- **descrição da página do mesário:** perdeu o número.

### `f2580fa` — Modais e avisos por cima do cabeçalho e da navegação

O `<main>` é `relative z-10` e cria um contexto de empilhamento. Um `fixed z-50` dentro
dele não passa por cima do cabeçalho nem da navegação de baixo. No celular, a barra ficava
por cima do fundo do modal, clicável.

- O modal "Novo avulso" do montador e o `EditPlayerModal` passam pelo `ModalPortal`, como
  os outros modais. O Esc não fecha o `EditPlayerModal` no meio do salvamento.
- Os avisos de "exportado" dos cards viraram o [Toast](../../src/components/ui/Toast.tsx),
  um portal para o `body` com `z-[100]`, `role="status"` e o topo abaixo da barra de status
  do iPhone.

### Commit de documentação — README, `AGENT.md` e registro

- **README:** trocou o do starter do Astro. Tem:
  - o que é o app, as páginas e a stack;
  - como rodar, com cada variável do `.env.example`;
  - os scripts e como os testes funcionam;
  - o deploy, com a migration antes do push, o `vercel-build` e o CI;
  - o PWA e o cache;
  - os links para a documentação.
- **`AGENT.md`**, nos pontos em que divergia do código:
  - o schema de verdade são as migrations, a partir da baseline;
  - o formato da rodada é 3 ou 4 times, com a duração por rodada;
  - a chave do mesário é `society_active_match_state:<sessionId>`;
  - os alvos de toque são de 44 × 44 e os campos de 16 px, conferidos pela `touch.spec`;
  - os modais passam pelo portal;
  - a validação é feita com lint, formato, tipos, testes e e2e;
  - as fases seguem os planos das fases, e não o roadmap 06;
  - migrations só por `npm run db:*`, com o `REVOKE … FROM PUBLIC, anon, authenticated`.
- `society-tracker-specs/` continua sem alteração.

## Migration e produção

Esta fase não tem migration. O deploy depende da `202609240003_close_session` da Fase 4,
que estava pendente no fim daquela fase: confira com `npm run db:status` antes do push, e
aplique com `npm run db:migrate -- --yes` se ainda faltar.

## Decisões

As quatro decisões em aberto no plano foram respondidas assim:

1. **Capitão no editor do mesário: exigido para salvar**, como no montador. A proposta era
   não exigir, porque o capitão pode ir embora no meio da noite, e o usuário escolheu
   exigir. Quando o capitão sai, o mesário marca outro antes de salvar. O servidor continua
   sem exigir.
2. **Nome do time quando o capitão sai:** volta para a cor só se era o automático. Pela
   mesma regra, marcar um capitão novo não apaga um nome digitado à mão.
3. **Navegação de baixo durante a partida:** escondida.
4. **Banner de lances pendentes:** em toda página, menos no mesário.

## Testes

- **Unitários:** de 159 para 180.
  - `team-rules.test.ts` (17): os tetos, o mover que ignora o teto da rodada, o nome
    automático e o nome à mão, a cor fora dos coletes, o capitão renomeado e a ordem do
    `saveProblems`;
  - `pending-on-device.test.ts` (3): a contagem por rodada, JSON inválido, versão errada,
    fila vazia e a chave antiga;
  - `use-cases.test.ts` (+1): a duração da rodada no caso de uso, com 480 e com o padrão
    de 420.
- **E2E:** de 23 para 26.
  - `teams.spec`: o editor recusa o 7º jogador e o mover para um time cheio, e não salva
    sem capitão;
  - `leave.spec`: a barra some durante a partida, o `beforeunload` aparece com lance
    pendente e não aparece depois que a fila é enviada;
  - `reports.spec` (+1): o card da rodada mostra "8 min ou 2 gols", e o aviso de exportado
    fica no `body`;
  - a `touch.spec` passou a conferir que os botões do rodapé de "Novo jogador", "Editar
    atleta" e "Editar times da rodada" recebem o toque, e que a barra de baixo fica atrás
    do modal. Antes da correção, a checagem acertava a barra.
- **Banner:** o harness não carrega o `Layout`. O banner foi conferido na página `/offline`
  do build real, no Edge a 360 × 640: some sem fila, aparece com o link de 44 px, usa o
  singular e some quando outra aba esvazia a fila.
- **Suíte inteira:** lint, formato, `check`, `check:astro`, `npm test`, `test:e2e` (26/26) e
  build passaram no fim. Cada commit passa sozinho em `npm run check` e `npm test`.

## O que ficou de fora

- Verificação num celular de verdade, depois do deploy:
  - a barra de baixo some durante a partida;
  - offline, um gol e outra página mostram o banner, e o link volta ao mesário;
  - "Novo avulso" e "Editar atleta" abrem por cima da barra;
  - o card PNG mostra a duração configurada;
  - o editor recusa o 7º jogador e o salvamento sem capitão.
- Tudo o que o plano deixou para a Fase 6 ou depois, listado no
  [README](README.md#situação-dos-pontos-do-levantamento-de-2209) como "Pendente": e2e no
  Astro real, paginação do histórico, composition root, tipos gerados do Supabase, RLS,
  observabilidade, elencos compartilhados entre aparelhos e as falhas intermitentes do
  e2e vistas na Fase 4.
